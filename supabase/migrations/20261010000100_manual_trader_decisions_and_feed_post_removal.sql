-- Administrators can make a direct final decision on an application. Approval
-- remains an administrator-only action, but the workflow checks are advisory.
CREATE OR REPLACE FUNCTION public.admin_decide_trader_application(
  p_application_id uuid,
  p_decision text,
  p_public_message text DEFAULT NULL,
  p_private_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reviewer_id uuid := public.request_member_id();
  application_row public.trader_applications%ROWTYPE;
  next_status public.trader_application_status;
  trader_slug text;
  public_text text := nullif(trim(coalesce(p_public_message, '')), '');
  private_text text := nullif(trim(coalesce(p_private_notes, '')), '');
BEGIN
  IF reviewer_id IS NULL OR NOT public.request_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'Choose approved or declined.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(public_text), 0) > 1200 OR coalesce(length(private_text), 0) > 4000 THEN
    RAISE EXCEPTION 'Decision notes are outside the allowed length.' USING ERRCODE = '22023';
  END IF;

  next_status := p_decision::public.trader_application_status;
  SELECT * INTO application_row
  FROM public.trader_applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.' USING ERRCODE = 'P0002';
  END IF;
  IF application_row.status IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'This application is already closed.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.trader_applications
  SET status = next_status,
      public_message = public_text,
      updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.trader_application_events (
    application_id, member_id, from_status, to_status, member_message, changed_by
  ) VALUES (
    application_row.id, application_row.member_id, application_row.status,
    next_status, public_text, reviewer_id
  );

  INSERT INTO public.trader_application_reviews (
    application_id, reviewer_id, private_notes
  ) VALUES (
    application_row.id, reviewer_id,
    coalesce(private_text, 'Direct administrator decision; standard review checks were bypassed.')
  );

  INSERT INTO public.audit_log (
    actor_id, action, entity_type, entity_id, reason, metadata
  ) VALUES (
    reviewer_id,
    CASE WHEN next_status = 'approved' THEN 'trader_application_approved_manual_override'
      ELSE 'trader_application_rejected' END,
    'trader_application', application_row.id,
    coalesce(private_text, 'Direct administrator decision.'),
    jsonb_build_object('manual_override', true, 'decision', next_status)
  );

  IF next_status = 'approved' THEN
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
        AND role IN ('founding_trader', 'financial_trader')
        AND revoked_at IS NULL
    ) THEN
      INSERT INTO public.staff_grants (member_id, role, granted_by, reason)
      VALUES (
        application_row.member_id, 'financial_trader', reviewer_id,
        'Trader application ' || application_row.id::text || ' approved by direct administrator decision.'
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_trader_application(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_trader_application(uuid, text, text, text) TO authenticated;

-- Posts are removed from public feeds by a soft-delete so replies and reaction
-- history remain intact. Only the author may remove a post from the feed.
CREATE OR REPLACE FUNCTION public.remove_community_post(p_post_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := public.request_member_id();
  post_row public.posts%ROWTYPE;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to remove a post.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO post_row
  FROM public.posts
  WHERE id = p_post_id AND removed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found.' USING ERRCODE = 'P0002';
  END IF;
  IF post_row.author_id <> actor_id THEN
    RAISE EXCEPTION 'Only the post author may remove this post.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.posts SET removed_at = now() WHERE id = post_row.id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, reason)
  VALUES (actor_id, 'community_post_removed', 'post', post_row.id, 'Removed by author.');

  RETURN post_row.attachment_key;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_community_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_community_post(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
