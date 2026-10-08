-- One public community room, backed by the room/message model in docs/schema.sql.
-- Apply after the schema, auth/community, post-file and performance migrations.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'chat'
    CHECK (message_kind IN ('chat', 'signal', 'setup', 'file')),
  ADD COLUMN IF NOT EXISTS instrument text CHECK (instrument IS NULL OR length(instrument) <= 20),
  ADD COLUMN IF NOT EXISTS direction text CHECK (direction IS NULL OR direction IN ('BUY', 'SELL')),
  ADD COLUMN IF NOT EXISTS entry_zone text CHECK (entry_zone IS NULL OR length(entry_zone) <= 80),
  ADD COLUMN IF NOT EXISTS invalidation text CHECK (invalidation IS NULL OR length(invalidation) <= 100),
  ADD COLUMN IF NOT EXISTS target_idea text CHECK (target_idea IS NULL OR length(target_idea) <= 80),
  ADD COLUMN IF NOT EXISTS attachment_name text CHECK (attachment_name IS NULL OR length(attachment_name) <= 255),
  ADD COLUMN IF NOT EXISTS attachment_mime text CHECK (
    attachment_mime IS NULL OR attachment_mime IN (
      'image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'
    )
  ),
  ADD COLUMN IF NOT EXISTS attachment_size bigint CHECK (attachment_size IS NULL OR attachment_size BETWEEN 1 AND 10000000),
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE INDEX IF NOT EXISTS community_messages_timeline_idx
  ON public.messages (room_id, created_at DESC)
  WHERE room_id IS NOT NULL AND removed_at IS NULL;
CREATE INDEX IF NOT EXISTS community_messages_reply_idx
  ON public.messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  reaction text NOT NULL CHECK (reaction IN ('like', 'love', 'fire', 'think', 'eyes')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, member_id, reaction)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.message_reaction_counts (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'love', 'fire', 'think', 'eyes')),
  reaction_count integer NOT NULL CHECK (reaction_count > 0),
  PRIMARY KEY (message_id, reaction)
);
ALTER TABLE public.message_reaction_counts ENABLE ROW LEVEL SECURITY;
INSERT INTO public.message_reaction_counts (message_id, reaction, reaction_count)
SELECT message_id, reaction, count(*)::integer
FROM public.message_reactions
GROUP BY message_id, reaction
ON CONFLICT (message_id, reaction) DO UPDATE SET reaction_count = EXCLUDED.reaction_count;

DROP POLICY IF EXISTS public_group_message_read ON public.messages;
CREATE POLICY public_group_message_read ON public.messages FOR SELECT TO anon, authenticated
  USING (removed_at IS NULL AND room_id IN (
    SELECT id FROM public.rooms WHERE slug = 'community' AND access = 'public' AND archived_at IS NULL
  ));

DROP POLICY IF EXISTS community_message_author_update ON public.messages;
CREATE POLICY community_message_author_update ON public.messages FOR UPDATE TO authenticated
  USING (author_id = public.request_member_id() AND room_id IN (
    SELECT id FROM public.rooms WHERE slug = 'community' AND access = 'public' AND archived_at IS NULL
  ))
  WITH CHECK (author_id = public.request_member_id() AND room_id IN (
    SELECT id FROM public.rooms WHERE slug = 'community' AND access = 'public' AND archived_at IS NULL
  ));

DROP POLICY IF EXISTS public_group_reaction_read ON public.message_reactions;
REVOKE ALL ON public.message_reactions FROM anon, authenticated;

DROP POLICY IF EXISTS public_group_reaction_count_read ON public.message_reaction_counts;
CREATE POLICY public_group_reaction_count_read ON public.message_reaction_counts FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.rooms r ON r.id = m.room_id
    WHERE m.id = message_id AND m.removed_at IS NULL AND r.slug = 'community'
      AND r.access = 'public' AND r.archived_at IS NULL
  ));

-- Expose only public-room reaction counts and whether the caller reacted. Raw
-- member IDs remain private, including for signed-out readers of the room.
REVOKE ALL ON public.message_reactions FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.community_reaction_summary(p_message_ids uuid[])
RETURNS TABLE(message_id uuid, reaction text, reaction_count bigint, reacted_by_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT mr.message_id, mr.reaction, count(*)::bigint,
    coalesce(bool_or(mr.member_id = public.request_member_id()), false)
  FROM public.message_reactions mr
  JOIN public.messages m ON m.id = mr.message_id
  JOIN public.rooms r ON r.id = m.room_id
  WHERE mr.message_id = ANY(coalesce(p_message_ids, ARRAY[]::uuid[]))
    AND m.removed_at IS NULL AND r.slug = 'community' AND r.access = 'public' AND r.archived_at IS NULL
  GROUP BY mr.message_id, mr.reaction;
$$;
REVOKE ALL ON FUNCTION public.community_reaction_summary(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_reaction_summary(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.toggle_community_reaction(p_message_id uuid, p_reaction text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_member uuid := public.request_member_id();
  already_reacted boolean;
BEGIN
  IF current_member IS NULL OR p_reaction NOT IN ('like', 'love', 'fire', 'think', 'eyes') THEN
    RAISE EXCEPTION 'Sign in and choose a supported reaction';
  END IF;

  PERFORM 1 FROM public.messages m
  JOIN public.rooms r ON r.id = m.room_id
  WHERE m.id = p_message_id AND m.removed_at IS NULL AND r.slug = 'community'
    AND r.access = 'public' AND r.archived_at IS NULL
  FOR UPDATE OF m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Public message is unavailable'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.message_reactions mr
    WHERE mr.message_id = p_message_id AND mr.member_id = current_member AND mr.reaction = p_reaction
  ) INTO already_reacted;

  IF already_reacted THEN
    DELETE FROM public.message_reactions mr
    WHERE mr.message_id = p_message_id AND mr.member_id = current_member AND mr.reaction = p_reaction;
    UPDATE public.message_reaction_counts
      SET reaction_count = reaction_count - 1
      WHERE message_id = p_message_id AND reaction = p_reaction;
    DELETE FROM public.message_reaction_counts
      WHERE message_id = p_message_id AND reaction = p_reaction AND reaction_count <= 0;
    RETURN false;
  END IF;

  INSERT INTO public.message_reactions (message_id, member_id, reaction)
  VALUES (p_message_id, current_member, p_reaction);
  INSERT INTO public.message_reaction_counts (message_id, reaction, reaction_count)
  VALUES (p_message_id, p_reaction, 1)
  ON CONFLICT (message_id, reaction) DO UPDATE
    SET reaction_count = public.message_reaction_counts.reaction_count + 1;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.toggle_community_reaction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_community_reaction(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_community_room()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_member uuid := public.request_member_id();
  community_room uuid;
BEGIN
  IF current_member IS NULL THEN
    RAISE EXCEPTION 'Sign in before joining the community room';
  END IF;

  INSERT INTO public.rooms (slug, title, description, room_type, access, created_by)
  VALUES ('community', 'The DRACARYS Community', 'The public group chat for market talk, ideas and files.', 'public', 'public', current_member)
  ON CONFLICT (slug) DO UPDATE SET access = 'public', room_type = 'public', archived_at = NULL;

  SELECT id INTO community_room FROM public.rooms WHERE slug = 'community';
  INSERT INTO public.room_members (room_id, member_id)
  VALUES (community_room, current_member)
  ON CONFLICT (room_id, member_id) DO UPDATE SET left_at = NULL;

  RETURN community_room;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_community_room() TO authenticated;
GRANT SELECT ON public.rooms, public.messages, public.message_reaction_counts TO anon, authenticated;
GRANT SELECT, INSERT ON public.room_members TO authenticated;
GRANT INSERT ON public.messages TO authenticated;
GRANT UPDATE (body, edited_at, removed_at) ON public.messages TO authenticated;

-- Existing installations can seed the public room from an already-registered
-- member. A fresh installation creates it when its first member joins.
DO $$
DECLARE
  first_member uuid;
BEGIN
  SELECT id INTO first_member FROM public.members ORDER BY created_at LIMIT 1;
  IF first_member IS NOT NULL THEN
    INSERT INTO public.rooms (slug, title, description, room_type, access, created_by)
    VALUES ('community', 'The DRACARYS Community', 'The public group chat for market talk, ideas and files.', 'public', 'public', first_member)
    ON CONFLICT (slug) DO UPDATE SET access = 'public', room_type = 'public', archived_at = NULL;
  END IF;
END;
$$;

-- Room messages and their reactions update every open community view.
DO $$
DECLARE
  relation_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH relation_name IN ARRAY ARRAY['messages', 'message_reaction_counts'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = relation_name
      ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || quote_ident(relation_name);
      END IF;
    END LOOP;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
