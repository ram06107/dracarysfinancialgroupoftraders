-- Run once in the Supabase SQL editor after the user has registered through
-- Supabase Auth and the DRACARYS member row exists. This grants a role only;
-- it does not create an Auth user or set/change anyone's password.
DO $$
DECLARE
  admin_member uuid;
BEGIN
  SELECT id INTO admin_member
  FROM public.members
  WHERE lower(email_private) = lower('ramphilipgarang@gmail.com')
  LIMIT 1;

  IF admin_member IS NULL THEN
    RAISE EXCEPTION 'No DRACARYS account exists for the configured administrator email. Register that account first, then run this script again.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff_grants
    WHERE member_id = admin_member AND role = 'super_admin' AND revoked_at IS NULL
  ) THEN
    INSERT INTO public.staff_grants (member_id, role, granted_by, reason)
    VALUES (admin_member, 'super_admin', admin_member, 'Initial DRACARYS super administrator');
  END IF;
END;
$$;
