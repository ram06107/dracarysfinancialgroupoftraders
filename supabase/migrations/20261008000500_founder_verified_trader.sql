-- The original founder is a verified founding trader without applying through
-- the later trader-application process. Other applicants remain unchanged.
DO $$
DECLARE
  founder_id uuid;
  founder_slug text;
BEGIN
  SELECT id INTO founder_id
  FROM public.members
  WHERE lower(email_private) = lower('ramphilipgarang@gmail.com')
  LIMIT 1;

  IF founder_id IS NULL THEN
    RAISE EXCEPTION 'The founder account must exist in public.members before granting founding trader status.';
  END IF;

  founder_slug := 'ram-philip-garang-rpg-i-' || left(replace(founder_id::text, '-', ''), 8);

  IF NOT EXISTS (
    SELECT 1 FROM public.staff_grants
    WHERE member_id = founder_id
      AND role = 'founding_trader'
      AND revoked_at IS NULL
  ) THEN
    INSERT INTO public.staff_grants (member_id, role, granted_by, reason)
    VALUES (founder_id, 'founding_trader', founder_id, 'DRACARYS founder; founding trader account verified by default');
  END IF;

  INSERT INTO public.trader_profiles AS current_profile (
    member_id, slug, public_name, trading_style, experience_summary, markets, is_published
  ) VALUES (
    founder_id,
    founder_slug,
    'RAM PHILIP GARANG RPG-I',
    'Founder and founding trader of DRACARYS Financial Group of Traders.',
    'Founder of DRACARYS Financial Group of Traders. Verified as a founding trader.',
    '{}',
    true
  )
  ON CONFLICT (member_id) DO UPDATE SET
    is_published = true,
    trading_style = CASE
      WHEN trim(current_profile.trading_style) = '' THEN EXCLUDED.trading_style
      ELSE current_profile.trading_style
    END,
    experience_summary = CASE
      WHEN trim(current_profile.experience_summary) = '' THEN EXCLUDED.experience_summary
      ELSE current_profile.experience_summary
    END,
    updated_at = now();
END;
$$;

NOTIFY pgrst, 'reload schema';
