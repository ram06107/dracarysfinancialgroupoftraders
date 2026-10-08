-- Public members may apply for a DRACARYS Financial Trader account.
-- Applying never grants trader privileges; an administrator must approve the
-- application through review_trader_application after completing due diligence.

CREATE TYPE public.trader_application_status AS ENUM (
  'submitted', 'reviewing', 'verification', 'assessment',
  'needs_information', 'approved', 'declined'
);

CREATE TABLE public.trader_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  public_name text NOT NULL CHECK (length(trim(public_name)) BETWEEN 2 AND 80),
  markets text[] NOT NULL DEFAULT '{}',
  years_experience smallint NOT NULL CHECK (years_experience BETWEEN 0 AND 60),
  experience_summary text NOT NULL CHECK (length(trim(experience_summary)) BETWEEN 40 AND 1600),
  trading_approach text NOT NULL CHECK (length(trim(trading_approach)) BETWEEN 80 AND 2400),
  assessment_response text NOT NULL CHECK (length(trim(assessment_response)) BETWEEN 120 AND 3200),
  code_accepted boolean NOT NULL CHECK (code_accepted = true),
  status public.trader_application_status NOT NULL DEFAULT 'submitted',
  public_message text CHECK (public_message IS NULL OR length(public_message) <= 1200),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trader_applications_review_queue_idx
  ON public.trader_applications (status, submitted_at DESC);
CREATE INDEX trader_applications_member_idx
  ON public.trader_applications (member_id, submitted_at DESC);
CREATE UNIQUE INDEX trader_applications_one_open_per_member_idx
  ON public.trader_applications (member_id) WHERE status <> 'declined';
COMMENT ON TABLE public.trader_applications IS
  'Private trader account applications. Applicants remain public members until a privileged review approves them.';

CREATE TABLE public.trader_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.trader_applications(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  from_status public.trader_application_status,
  to_status public.trader_application_status NOT NULL,
  member_message text CHECK (member_message IS NULL OR length(member_message) <= 1200),
  changed_by uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trader_application_events_timeline_idx
  ON public.trader_application_events (application_id, created_at);

CREATE TABLE public.trader_application_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.trader_applications(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  response text NOT NULL CHECK (length(trim(response)) BETWEEN 20 AND 1800),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trader_application_responses_timeline_idx
  ON public.trader_application_responses (application_id, created_at);

-- Verification notes and scores are visible to administrators only. Do not put
-- identity documents, account statements or other sensitive evidence here.
CREATE TABLE public.trader_application_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.trader_applications(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  identity_verified boolean NOT NULL DEFAULT false,
  background_verified boolean NOT NULL DEFAULT false,
  assessment_passed boolean NOT NULL DEFAULT false,
  assessment_score smallint CHECK (assessment_score IS NULL OR assessment_score BETWEEN 0 AND 100),
  private_notes text NOT NULL DEFAULT '' CHECK (length(private_notes) <= 4000),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trader_application_reviews_latest_idx
  ON public.trader_application_reviews (application_id, reviewed_at DESC);

ALTER TABLE public.trader_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY trader_applications_owner_or_admin_read ON public.trader_applications FOR SELECT
  USING (member_id = public.request_member_id() OR public.request_is_admin());
CREATE POLICY trader_applications_member_submit ON public.trader_applications FOR INSERT
  WITH CHECK (
    member_id = public.request_member_id()
    AND status = 'submitted'
    AND code_accepted
    AND NOT public.request_has_staff_role('founding_trader')
    AND NOT public.request_has_staff_role('financial_trader')
  );

ALTER TABLE public.trader_application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY trader_application_events_owner_or_admin_read ON public.trader_application_events FOR SELECT
  USING (member_id = public.request_member_id() OR public.request_is_admin());

ALTER TABLE public.trader_application_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY trader_application_responses_owner_or_admin_read ON public.trader_application_responses FOR SELECT
  USING (member_id = public.request_member_id() OR public.request_is_admin());
CREATE POLICY trader_application_responses_member_submit ON public.trader_application_responses FOR INSERT
  WITH CHECK (
    member_id = public.request_member_id()
    AND EXISTS (
      SELECT 1 FROM public.trader_applications a
      WHERE a.id = application_id AND a.member_id = public.request_member_id()
        AND a.status = 'needs_information'
    )
  );

ALTER TABLE public.trader_application_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY trader_application_reviews_admin_read ON public.trader_application_reviews FOR SELECT
  USING (public.request_is_admin());

-- Approved traders receive a distinct role from the original founding traders.
-- Both roles can manage their own published trader record and execution history.
CREATE OR REPLACE FUNCTION public.request_owns_trader(profile_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trader_profiles t
    JOIN public.staff_grants g ON g.member_id = t.member_id
    WHERE t.id = profile_id AND t.member_id = public.request_member_id()
      AND g.role IN ('founding_trader', 'financial_trader') AND g.revoked_at IS NULL
  )
$$;

DROP POLICY IF EXISTS trader_profile_owner_update ON public.trader_profiles;
CREATE POLICY trader_profile_owner_update ON public.trader_profiles FOR UPDATE
  USING (member_id = public.request_member_id() AND (
    public.request_has_staff_role('founding_trader') OR public.request_has_staff_role('financial_trader')
  ))
  WITH CHECK (member_id = public.request_member_id() AND (
    public.request_has_staff_role('founding_trader') OR public.request_has_staff_role('financial_trader')
  ));

REVOKE ALL ON public.trader_applications, public.trader_application_events,
  public.trader_application_responses,
  public.trader_application_reviews FROM anon, authenticated;
GRANT SELECT ON public.trader_applications TO authenticated;
GRANT INSERT (member_id, public_name, markets, years_experience, experience_summary,
  trading_approach, assessment_response, code_accepted)
  ON public.trader_applications TO authenticated;
GRANT SELECT ON public.trader_application_events, public.trader_application_responses,
  public.trader_application_reviews TO authenticated;
GRANT INSERT (application_id, member_id, response)
  ON public.trader_application_responses TO authenticated;

CREATE OR REPLACE FUNCTION public.record_trader_application_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.trader_application_events (
    application_id, member_id, from_status, to_status, member_message, changed_by
  ) VALUES (
    NEW.id, NEW.member_id, NULL, NEW.status,
    'Your application is in the review queue. You will see updates here.',
    NEW.member_id
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER trader_application_submitted_event
AFTER INSERT ON public.trader_applications
FOR EACH ROW EXECUTE FUNCTION public.record_trader_application_submission();

CREATE OR REPLACE FUNCTION public.review_trader_application(
  p_application_id uuid,
  p_new_status public.trader_application_status,
  p_identity_verified boolean,
  p_background_verified boolean,
  p_assessment_passed boolean,
  p_assessment_score smallint,
  p_public_message text,
  p_private_notes text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  application_row public.trader_applications%ROWTYPE;
  reviewer_id uuid := public.request_member_id();
  trader_slug text;
BEGIN
  IF reviewer_id IS NULL OR NOT public.request_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_new_status IS NULL OR p_new_status NOT IN ('reviewing', 'verification', 'assessment', 'needs_information', 'approved', 'declined') THEN
    RAISE EXCEPTION 'That review stage is not valid.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(p_public_message), 0) > 1200 OR coalesce(length(p_private_notes), 0) > 4000 THEN
    RAISE EXCEPTION 'Review text is too long.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO application_row
  FROM public.trader_applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.' USING ERRCODE = 'P0002';
  END IF;
  IF application_row.status IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'This application is closed.' USING ERRCODE = '22023';
  END IF;

  IF p_new_status = 'approved' AND (
    NOT coalesce(p_identity_verified, false)
    OR NOT coalesce(p_background_verified, false)
    OR NOT coalesce(p_assessment_passed, false)
    OR coalesce(p_assessment_score, 0) < 70
    OR NOT application_row.code_accepted
  ) THEN
    RAISE EXCEPTION 'Approval requires verified identity and background, accepted trader standards, and a passing assessment score of at least 70.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.trader_applications
  SET status = p_new_status,
      public_message = nullif(trim(coalesce(p_public_message, '')), ''),
      updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.trader_application_reviews (
    application_id, reviewer_id, identity_verified, background_verified,
    assessment_passed, assessment_score, private_notes
  ) VALUES (
    p_application_id, reviewer_id, coalesce(p_identity_verified, false),
    coalesce(p_background_verified, false), coalesce(p_assessment_passed, false),
    p_assessment_score, trim(coalesce(p_private_notes, ''))
  );

  IF application_row.status IS DISTINCT FROM p_new_status OR nullif(trim(coalesce(p_public_message, '')), '') IS NOT NULL THEN
    INSERT INTO public.trader_application_events (
      application_id, member_id, from_status, to_status, member_message, changed_by
    ) VALUES (
      application_row.id, application_row.member_id, application_row.status,
      p_new_status, nullif(trim(coalesce(p_public_message, '')), ''), reviewer_id
    );
  END IF;

  IF p_new_status = 'approved' THEN
    trader_slug := trim(both '-' FROM regexp_replace(lower(application_row.public_name), '[^a-z0-9]+', '-', 'g'))
      || '-' || left(replace(application_row.member_id::text, '-', ''), 8);
    INSERT INTO public.trader_profiles (
      member_id, slug, public_name, trading_style, experience_summary, markets, is_published
    ) VALUES (
      application_row.member_id, trader_slug, application_row.public_name,
      application_row.trading_approach, application_row.experience_summary,
      application_row.markets, true
    )
    ON CONFLICT (member_id) DO UPDATE SET
      slug = EXCLUDED.slug,
      public_name = EXCLUDED.public_name,
      trading_style = EXCLUDED.trading_style,
      experience_summary = EXCLUDED.experience_summary,
      markets = EXCLUDED.markets,
      is_published = true,
      updated_at = now();

    IF NOT EXISTS (
      SELECT 1 FROM public.staff_grants
      WHERE member_id = application_row.member_id
        AND role IN ('founding_trader', 'financial_trader') AND revoked_at IS NULL
    ) THEN
      INSERT INTO public.staff_grants (member_id, role, granted_by, reason)
      VALUES (application_row.member_id, 'financial_trader', reviewer_id,
        'Trader application ' || application_row.id::text || ' approved.');
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_trader_application_submission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_trader_application(
  uuid, public.trader_application_status, boolean, boolean, boolean, smallint, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_trader_application(
  uuid, public.trader_application_status, boolean, boolean, boolean, smallint, text, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- After this migration, assign the first super administrator manually from the
-- Supabase SQL editor, replacing the email with an already registered account:
--
-- INSERT INTO public.staff_grants (member_id, role, granted_by, reason)
-- SELECT m.id, 'super_admin', m.id, 'Initial platform administrator'
-- FROM public.members m
-- WHERE lower(m.email_private) = lower('admin@example.com')
--   AND NOT EXISTS (
--     SELECT 1 FROM public.staff_grants g
--     WHERE g.member_id = m.id AND g.role = 'super_admin' AND g.revoked_at IS NULL
--   );
