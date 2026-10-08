-- Supabase adapter for the platform's initial identity and community slice.
-- Run docs/schema.sql first, then apply this migration in the same database.

CREATE TABLE public.public_member_profiles (
  id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  public_name text NOT NULL CHECK (length(trim(public_name)) BETWEEN 1 AND 80),
  bio text NOT NULL DEFAULT '' CHECK (length(bio) <= 500),
  avatar_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.public_member_profiles IS
  'Fields safe for public community display. Email and account data remain in members/auth.users.';

-- Supabase signs the JWT and provides auth.uid() to Postgres for each request.
CREATE OR REPLACE FUNCTION public.request_member_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT auth.uid() $$;

CREATE OR REPLACE FUNCTION public.bootstrap_auth_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  chosen_name text;
BEGIN
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RAISE EXCEPTION 'an email address is required for a DRACARYS account';
  END IF;

  chosen_name := left(trim(coalesce(
    NEW.raw_user_meta_data ->> 'display_name',
    split_part(NEW.email, '@', 1)
  )), 80);
  IF length(chosen_name) < 1 THEN chosen_name := 'Member'; END IF;

  INSERT INTO public.members (id, email_private, display_name)
  VALUES (NEW.id, NEW.email, chosen_name)
  ON CONFLICT (id) DO UPDATE
    SET email_private = EXCLUDED.email_private,
        updated_at = now();

  INSERT INTO public.public_member_profiles (id, public_name)
  VALUES (NEW.id, chosen_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER dracarys_auth_member_insert
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_auth_member();

CREATE TRIGGER dracarys_auth_member_email_update
AFTER UPDATE OF email ON auth.users
FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.bootstrap_auth_member();

ALTER TABLE public.public_member_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_profiles_read ON public.public_member_profiles
  FOR SELECT USING (true);
CREATE POLICY public_profiles_owner_update ON public.public_member_profiles
  FOR UPDATE USING (id = public.request_member_id())
  WITH CHECK (id = public.request_member_id());

-- Explicit grants complement RLS. The public role can read the open feed, while
-- all writing routes require an authenticated subject and matching ownership rule.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.read_assigned_reported_message(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.posts, public.comments, public.public_member_profiles
  TO anon, authenticated;
GRANT INSERT ON public.posts, public.comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_reactions TO authenticated;
GRANT UPDATE (public_name, bio, avatar_key) ON public.public_member_profiles TO authenticated;

CREATE OR REPLACE VIEW public.community_post_reaction_totals
WITH (security_invoker = false)
AS
SELECT post_id, reaction, count(*)::integer AS total
FROM public.post_reactions
WHERE EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_reactions.post_id
    AND p.visibility = 'public'
    AND p.removed_at IS NULL
)
GROUP BY post_id, reaction;
GRANT SELECT ON public.community_post_reaction_totals TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.request_member_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_has_staff_role(public.staff_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_is_premium() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_owns_trader(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_can_access_course(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_is_course_mentor(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_assigned_reported_message(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
