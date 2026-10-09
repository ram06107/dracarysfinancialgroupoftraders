-- Private image attachments for personal journal entries.
-- Apply after the existing platform and profile journal migrations.

ALTER TABLE public.personal_journal_entries
  ADD COLUMN IF NOT EXISTS image_key text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'personal-journal-images',
  'personal-journal-images',
  false,
  8388608,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS personal_journal_images_owner_read ON storage.objects;
CREATE POLICY personal_journal_images_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'personal-journal-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS personal_journal_images_owner_upload ON storage.objects;
CREATE POLICY personal_journal_images_owner_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'personal-journal-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS personal_journal_images_owner_delete ON storage.objects;
CREATE POLICY personal_journal_images_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'personal-journal-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
