-- Private contact details and Zoom interview scheduling for trader applications.
ALTER TABLE public.trader_applications
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS preferred_timezone text NOT NULL DEFAULT 'Africa/Kampala',
  ADD COLUMN IF NOT EXISTS interview_availability text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interview_at timestamptz,
  ADD COLUMN IF NOT EXISTS zoom_url text,
  ADD COLUMN IF NOT EXISTS interview_completed_at timestamptz;

UPDATE public.trader_applications a
SET contact_name = coalesce(a.contact_name, a.public_name),
    contact_email = coalesce(a.contact_email, m.email_private)
FROM public.members m
WHERE m.id = a.member_id;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trader_application_contact_name_check') THEN
    ALTER TABLE public.trader_applications ADD CONSTRAINT trader_application_contact_name_check
      CHECK (contact_name IS NULL OR length(trim(contact_name)) BETWEEN 2 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trader_application_contact_email_check') THEN
    ALTER TABLE public.trader_applications ADD CONSTRAINT trader_application_contact_email_check
      CHECK (contact_email IS NULL OR (length(contact_email) <= 254 AND contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trader_application_contact_phone_check') THEN
    ALTER TABLE public.trader_applications ADD CONSTRAINT trader_application_contact_phone_check
      CHECK (contact_phone IS NULL OR (
        contact_phone ~ '^[+()0-9 .-]{7,32}$'
        AND length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trader_application_timezone_check') THEN
    ALTER TABLE public.trader_applications ADD CONSTRAINT trader_application_timezone_check
      CHECK (length(trim(preferred_timezone)) BETWEEN 1 AND 64);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trader_application_availability_check') THEN
    ALTER TABLE public.trader_applications ADD CONSTRAINT trader_application_availability_check
      CHECK (length(interview_availability) <= 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trader_application_zoom_url_check') THEN
    ALTER TABLE public.trader_applications ADD CONSTRAINT trader_application_zoom_url_check
      CHECK (zoom_url IS NULL OR zoom_url ~* '^https://([a-z0-9-]+\.)*zoom\.us(/|$)');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trader_applications_interview_idx
  ON public.trader_applications (interview_at)
  WHERE interview_at IS NOT NULL;

DROP POLICY IF EXISTS trader_applications_member_submit ON public.trader_applications;
CREATE POLICY trader_applications_member_submit ON public.trader_applications FOR INSERT
  WITH CHECK (
    member_id = public.request_member_id()
    AND status = 'submitted'
    AND code_accepted
    AND length(trim(coalesce(contact_name, ''))) BETWEEN 2 AND 120
    AND contact_phone ~ '^[+()0-9 .-]{7,32}$'
    AND length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15
    AND contact_email IS NOT NULL
    AND lower(contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND length(trim(preferred_timezone)) BETWEEN 1 AND 64
    AND length(interview_availability) <= 500
    AND NOT public.request_has_staff_role('founding_trader')
    AND NOT public.request_has_staff_role('financial_trader')
  );

REVOKE INSERT (member_id, public_name, markets, years_experience, experience_summary,
  trading_approach, assessment_response, code_accepted)
  ON public.trader_applications FROM authenticated;
GRANT INSERT (member_id, public_name, markets, years_experience, experience_summary,
  trading_approach, assessment_response, code_accepted, contact_name, contact_email,
  contact_phone, preferred_timezone, interview_availability)
  ON public.trader_applications TO authenticated;

-- Feed publication is a professional privilege. The Telegram-like public group
-- chat uses public.messages and remains open to every signed-in member.
CREATE OR REPLACE FUNCTION public.request_can_publish_feed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.request_is_admin()
    OR public.request_has_staff_role('founding_trader')
    OR public.request_has_staff_role('financial_trader')
$$;
REVOKE ALL ON FUNCTION public.request_can_publish_feed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_can_publish_feed() TO authenticated;

DROP POLICY IF EXISTS posts_member_insert ON public.posts;
CREATE POLICY posts_member_insert ON public.posts FOR INSERT
  WITH CHECK (
    author_id = public.request_member_id()
    AND public.request_can_publish_feed()
    AND (visibility = 'public' OR public.request_is_premium())
  );
DROP POLICY IF EXISTS posts_author_or_admin_update ON public.posts;
CREATE POLICY posts_author_or_admin_update ON public.posts FOR UPDATE
  USING (author_id = public.request_member_id() AND public.request_can_publish_feed())
  WITH CHECK (author_id = public.request_member_id() AND public.request_can_publish_feed());

-- Community uploads use a dedicated folder; feed attachments require trader
-- publication rights, even when a caller bypasses the app's composer.
DROP POLICY IF EXISTS community_files_owner_upload ON storage.objects;
CREATE POLICY community_files_owner_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      (storage.foldername(name))[2] = 'community'
      OR public.request_can_publish_feed()
    )
  );

CREATE OR REPLACE FUNCTION public.schedule_trader_interview(
  p_application_id uuid,
  p_interview_at timestamptz,
  p_zoom_url text,
  p_public_message text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  current_reviewer_id uuid := public.request_member_id();
  application_row public.trader_applications%ROWTYPE;
  message_text text := nullif(trim(coalesce(p_public_message, '')), '');
BEGIN
  IF current_reviewer_id IS NULL OR NOT public.request_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_interview_at IS NULL OR p_interview_at <= now()
     OR p_zoom_url IS NULL OR p_zoom_url !~* '^https://([a-z0-9-]+\.)*zoom\.us(/|$)'
     OR length(p_zoom_url) > 500 OR coalesce(length(message_text), 0) > 1200 THEN
    RAISE EXCEPTION 'Provide a future appointment, a valid Zoom link and a short applicant message.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO application_row
  FROM public.trader_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found.' USING ERRCODE = 'P0002'; END IF;
  IF application_row.status IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'This application is closed.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.trader_applications
  SET status = 'interview_scheduled', interview_at = p_interview_at,
      zoom_url = trim(p_zoom_url), interview_completed_at = NULL,
      public_message = message_text, updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.trader_application_events (
    application_id, member_id, from_status, to_status, member_message, changed_by
  ) VALUES (
    application_row.id, application_row.member_id, application_row.status,
    'interview_scheduled', coalesce(message_text, 'A Zoom interview has been scheduled. Check the appointment details in your application.'), current_reviewer_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_trader_interview(uuid, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_trader_interview(uuid, timestamptz, text, text) TO authenticated;

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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  application_row public.trader_applications%ROWTYPE;
  current_reviewer_id uuid := public.request_member_id();
  trader_slug text;
  latest_review_id uuid;
  public_text text := nullif(trim(coalesce(p_public_message, '')), '');
BEGIN
  IF current_reviewer_id IS NULL OR NOT public.request_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_new_status IS NULL OR p_new_status NOT IN (
    'reviewing', 'verification', 'assessment', 'interview_scheduled', 'interview_completed',
    'needs_information', 'approved', 'declined'
  ) THEN
    RAISE EXCEPTION 'That review stage is not valid.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(public_text), 0) > 1200 OR coalesce(length(p_private_notes), 0) > 4000
     OR (p_assessment_score IS NOT NULL AND p_assessment_score NOT BETWEEN 0 AND 100) THEN
    RAISE EXCEPTION 'Review details are outside the allowed range.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO application_row FROM public.trader_applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found.' USING ERRCODE = 'P0002'; END IF;
  IF application_row.status IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'This application is closed.' USING ERRCODE = '22023';
  END IF;
  IF p_new_status = 'interview_scheduled' AND (application_row.interview_at IS NULL OR application_row.zoom_url IS NULL) THEN
    RAISE EXCEPTION 'Arrange the Zoom interview before using this review stage.' USING ERRCODE = '22023';
  END IF;
  IF p_new_status = 'interview_completed' AND (
    application_row.interview_at IS NULL OR application_row.zoom_url IS NULL
    OR (application_row.status <> 'interview_scheduled' AND application_row.interview_completed_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'Schedule and complete the Zoom interview before marking it complete.' USING ERRCODE = '22023';
  END IF;
  IF p_new_status = 'approved' AND (
    application_row.interview_completed_at IS NULL
    OR NOT coalesce(p_identity_verified, false)
    OR NOT coalesce(p_background_verified, false)
    OR NOT coalesce(p_assessment_passed, false)
    OR coalesce(p_assessment_score, 0) < 70
    OR NOT application_row.code_accepted
  ) THEN
    RAISE EXCEPTION 'Approval requires a completed Zoom interview, verified identity and background, accepted trader standards, and a passing assessment score of at least 70.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.trader_applications
  SET status = p_new_status,
      interview_completed_at = CASE
        WHEN p_new_status = 'interview_completed' THEN coalesce(interview_completed_at, now())
        ELSE interview_completed_at
      END,
      public_message = public_text,
      updated_at = now()
  WHERE id = p_application_id;

  SELECT id INTO latest_review_id FROM public.trader_application_reviews
  WHERE trader_application_reviews.application_id = p_application_id
    AND trader_application_reviews.reviewer_id = current_reviewer_id
  ORDER BY reviewed_at DESC LIMIT 1;
  IF latest_review_id IS NULL THEN
    INSERT INTO public.trader_application_reviews (
      application_id, reviewer_id, identity_verified, background_verified,
      assessment_passed, assessment_score, private_notes
    ) VALUES (
      p_application_id, current_reviewer_id, coalesce(p_identity_verified, false),
      coalesce(p_background_verified, false), coalesce(p_assessment_passed, false),
      p_assessment_score, trim(coalesce(p_private_notes, ''))
    );
  ELSE
    UPDATE public.trader_application_reviews SET
      identity_verified = coalesce(p_identity_verified, false),
      background_verified = coalesce(p_background_verified, false),
      assessment_passed = coalesce(p_assessment_passed, false),
      assessment_score = p_assessment_score,
      private_notes = trim(coalesce(p_private_notes, '')),
      reviewed_at = now()
    WHERE id = latest_review_id;
  END IF;

  IF application_row.status IS DISTINCT FROM p_new_status OR public_text IS NOT NULL THEN
    INSERT INTO public.trader_application_events (
      application_id, member_id, from_status, to_status, member_message, changed_by
    ) VALUES (
      application_row.id, application_row.member_id, application_row.status,
      p_new_status, public_text, current_reviewer_id
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
      SELECT 1 FROM public.staff_grants WHERE member_id = application_row.member_id
        AND role IN ('founding_trader', 'financial_trader') AND revoked_at IS NULL
    ) THEN
      INSERT INTO public.staff_grants (member_id, role, granted_by, reason)
      VALUES (application_row.member_id, 'financial_trader', current_reviewer_id,
        'Trader application ' || application_row.id::text || ' approved.');
    END IF;
  END IF;
END;
$$;

-- Give the requested first administrator access only if this address already
-- has a member identity. Supabase Auth owns account creation and credentials.
DO $$
DECLARE
  initial_admin uuid;
BEGIN
  SELECT id INTO initial_admin FROM public.members
  WHERE lower(email_private) = lower('ramphilipgarang@gmail.com')
  LIMIT 1;
  IF initial_admin IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_grants WHERE member_id = initial_admin
      AND role = 'super_admin' AND revoked_at IS NULL
  ) THEN
    INSERT INTO public.staff_grants (member_id, role, granted_by, reason)
    VALUES (initial_admin, 'super_admin', initial_admin, 'Initial DRACARYS super administrator');
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
