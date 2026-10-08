-- Extend the public community feed with structured trade posts and member files.
-- Apply after docs/schema.sql and 202610030001_auth_community.sql.

ALTER TABLE public.posts
  ADD COLUMN post_kind text NOT NULL DEFAULT 'chat'
    CHECK (post_kind IN ('chat', 'signal', 'setup', 'file')),
  ADD COLUMN instrument text CHECK (instrument IS NULL OR length(instrument) <= 20),
  ADD COLUMN direction text CHECK (direction IS NULL OR direction IN ('BUY', 'SELL')),
  ADD COLUMN entry_zone text CHECK (entry_zone IS NULL OR length(entry_zone) <= 80),
  ADD COLUMN invalidation text CHECK (invalidation IS NULL OR length(invalidation) <= 100),
  ADD COLUMN target_idea text CHECK (target_idea IS NULL OR length(target_idea) <= 80),
  ADD COLUMN attachment_name text CHECK (attachment_name IS NULL OR length(attachment_name) <= 255),
  ADD COLUMN attachment_mime text CHECK (
    attachment_mime IS NULL OR attachment_mime IN (
      'image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'
    )
  ),
  ADD COLUMN attachment_size bigint CHECK (attachment_size IS NULL OR attachment_size BETWEEN 1 AND 10000000);

CREATE INDEX posts_kind_feed_idx ON public.posts (post_kind, created_at DESC)
  WHERE removed_at IS NULL AND visibility = 'public';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-files',
  'community-files',
  true,
  10000000,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS community_files_public_read ON storage.objects;
CREATE POLICY community_files_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'community-files');

DROP POLICY IF EXISTS community_files_owner_upload ON storage.objects;
CREATE POLICY community_files_owner_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS community_files_owner_delete ON storage.objects;
CREATE POLICY community_files_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT ON public.posts TO authenticated;
