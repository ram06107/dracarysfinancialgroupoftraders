-- Add transparent performance summaries, optional anonymous member aggregates,
-- profile photos and database change delivery. Requires docs/schema.sql and the
-- earlier authentication/community migrations.

ALTER TABLE public.public_member_profiles
  ADD COLUMN IF NOT EXISTS share_performance boolean NOT NULL DEFAULT false;
GRANT UPDATE (share_performance) ON public.public_member_profiles TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', true, 2000000, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_avatars_public_read ON storage.objects;
CREATE POLICY profile_avatars_public_read ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'profile-avatars');
DROP POLICY IF EXISTS profile_avatars_owner_upload ON storage.objects;
CREATE POLICY profile_avatars_owner_upload ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS profile_avatars_owner_delete ON storage.objects;
CREATE POLICY profile_avatars_owner_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Members may read their own journal execution rows. Public pages only receive
-- daily aggregates when at least five opted-in members contributed that day.
GRANT SELECT ON public.member_executions TO authenticated;
GRANT SELECT ON public.trader_profiles TO anon, authenticated;
GRANT SELECT ON public.live_setup_record TO anon, authenticated;

CREATE OR REPLACE VIEW public.community_execution_daily
WITH (security_invoker = false)
AS
SELECT
  e.traded_at::date AS traded_on,
  count(*)::integer AS member_taken,
  count(*) FILTER (WHERE e.result = 'win')::integer AS wins,
  count(*) FILTER (WHERE e.result = 'loss')::integer AS losses,
  count(*) FILTER (WHERE e.result IS NULL OR e.result = 'unresolved')::integer AS open,
  count(DISTINCT e.member_id)::integer AS contributors
FROM public.member_executions e
JOIN public.public_member_profiles p
  ON p.id = e.member_id AND p.share_performance = true
WHERE e.traded_at IS NOT NULL
GROUP BY e.traded_at::date
HAVING count(DISTINCT e.member_id) >= 5;

CREATE OR REPLACE VIEW public.performance_events
WITH (security_invoker = false)
AS
SELECT
  ('setup:' || r.setup_id::text) AS event_id,
  r.published_at AS happened_at,
  'setup'::text AS metric,
  r.trader_profile_id
FROM public.live_setup_record r
JOIN public.trader_profiles t ON t.id = r.trader_profile_id AND t.is_published = true
UNION ALL
SELECT
  ('result:' || r.setup_id::text),
  coalesce(r.result_recorded_at, r.published_at),
  CASE r.current_result WHEN 'win' THEN 'win' WHEN 'loss' THEN 'loss' ELSE 'open' END,
  r.trader_profile_id
FROM public.live_setup_record r
JOIN public.trader_profiles t ON t.id = r.trader_profile_id AND t.is_published = true
WHERE r.current_result IN ('win', 'loss', 'unresolved')
UNION ALL
SELECT
  ('founder-taken:' || x.setup_id::text),
  x.created_at,
  'founder_taken'::text,
  x.trader_profile_id
FROM public.setup_trader_execution_current x
JOIN public.setups s ON s.id = x.setup_id AND s.is_demo = false
JOIN public.trader_profiles t ON t.id = x.trader_profile_id AND t.is_published = true
WHERE x.execution_state = 'taken'
UNION ALL
SELECT
  ('community-' || d.traded_on::text || '-' || metric.metric),
  d.traded_on::timestamptz,
  metric.metric,
  NULL::uuid
FROM public.community_execution_daily d
CROSS JOIN LATERAL (VALUES
  ('member_taken'::text, d.member_taken),
  ('win'::text, d.wins),
  ('loss'::text, d.losses),
  ('open'::text, d.open)
) AS metric(metric, amount)
CROSS JOIN LATERAL generate_series(1, metric.amount) AS occurrence(value);

CREATE OR REPLACE VIEW public.public_trader_performance
WITH (security_invoker = false)
AS
SELECT
  t.id AS trader_profile_id,
  t.slug,
  t.member_id,
  t.public_name,
  t.trading_style,
  t.experience_summary,
  t.markets,
  t.profile_image_key,
  count(e.event_id) FILTER (WHERE e.metric = 'setup')::integer AS setups,
  count(e.event_id) FILTER (WHERE e.metric = 'founder_taken')::integer AS taken,
  count(e.event_id) FILTER (WHERE e.metric = 'win')::integer AS wins,
  count(e.event_id) FILTER (WHERE e.metric = 'loss')::integer AS losses,
  count(e.event_id) FILTER (WHERE e.metric = 'open')::integer AS open
FROM public.trader_profiles t
LEFT JOIN public.performance_events e ON e.trader_profile_id = t.id
WHERE t.is_published = true
GROUP BY t.id;

GRANT SELECT ON public.community_execution_daily TO anon, authenticated;
GRANT SELECT ON public.performance_events, public.public_trader_performance TO anon, authenticated;

-- Realtime feeds only public post/comment/reaction events. The existing row
-- policies continue to determine which changes each subscriber may receive.
DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY['posts', 'comments', 'post_reactions'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || quote_ident(table_name);
      END IF;
    END LOOP;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
