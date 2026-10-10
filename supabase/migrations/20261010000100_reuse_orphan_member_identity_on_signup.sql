-- Reuse a pre-existing member identity when its email has no matching Auth user.
-- This prevents the auth.users insert trigger from failing on
-- members_email_private_key while preserving the member's existing references.
-- Supabase runs auth.users triggers in the signup transaction, so a trigger error
-- otherwise rolls back the account creation.

CREATE OR REPLACE FUNCTION public.reuse_orphan_member_identity_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing_member_id uuid;
BEGIN
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT m.id
    INTO existing_member_id
  FROM public.members AS m
  WHERE lower(trim(m.email_private)) = lower(trim(NEW.email))
    AND NOT EXISTS (
      SELECT 1
      FROM auth.users AS u
      WHERE u.id = m.id
    )
  ORDER BY (m.email_private = NEW.email) DESC, m.created_at, m.id
  LIMIT 1
  FOR UPDATE OF m;

  IF existing_member_id IS NOT NULL THEN
    NEW.id := existing_member_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reuse_orphan_member_identity_on_signup()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dracarys_auth_member_reuse_identity ON auth.users;
CREATE TRIGGER dracarys_auth_member_reuse_identity
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.reuse_orphan_member_identity_on_signup();
