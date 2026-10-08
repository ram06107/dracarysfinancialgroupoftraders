-- Label public outcomes by the record they came from. Founder setup outcomes
-- and anonymous community execution aggregates are separate performance cohorts.
CREATE OR REPLACE VIEW public.performance_events
WITH (security_invoker = false)
AS
SELECT
  ('setup:' || r.setup_id::text) AS event_id,
  r.published_at AS happened_at,
  'setup'::text AS metric,
  r.trader_profile_id,
  'founder'::text AS cohort
FROM public.live_setup_record r
JOIN public.trader_profiles t ON t.id = r.trader_profile_id AND t.is_published = true
UNION ALL
SELECT
  ('result:' || r.setup_id::text),
  coalesce(r.result_recorded_at, r.published_at),
  CASE r.current_result WHEN 'win' THEN 'win' WHEN 'loss' THEN 'loss' ELSE 'open' END,
  r.trader_profile_id,
  'founder'::text
FROM public.live_setup_record r
JOIN public.trader_profiles t ON t.id = r.trader_profile_id AND t.is_published = true
WHERE r.current_result IN ('win', 'loss', 'unresolved')
UNION ALL
SELECT
  ('founder-taken:' || x.setup_id::text),
  x.created_at,
  'founder_taken'::text,
  x.trader_profile_id,
  'founder'::text
FROM public.setup_trader_execution_current x
JOIN public.setups s ON s.id = x.setup_id AND s.is_demo = false
JOIN public.trader_profiles t ON t.id = x.trader_profile_id AND t.is_published = true
WHERE x.execution_state = 'taken'
UNION ALL
SELECT
  ('community-' || d.traded_on::text || '-' || metric.metric),
  d.traded_on::timestamptz,
  metric.metric,
  NULL::uuid,
  'community'::text
FROM public.community_execution_daily d
CROSS JOIN LATERAL (VALUES
  ('member_taken'::text, d.member_taken),
  ('win'::text, d.wins),
  ('loss'::text, d.losses),
  ('open'::text, d.open)
) AS metric(metric, amount)
CROSS JOIN LATERAL generate_series(1, metric.amount) AS occurrence(value);

GRANT SELECT ON public.performance_events TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
