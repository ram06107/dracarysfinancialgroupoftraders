import { createClient } from "@/lib/supabase/server";
import type { PerformanceEvent, PerformanceMetric } from "@/lib/performance";

const metrics = new Set<PerformanceMetric>(["setup", "founder_taken", "member_taken", "win", "loss", "open"]);

function mapPublicEvents(rows: Array<{ event_id: string; happened_at: string; metric: string; trader_profile_id: string | null; cohort?: string }> | null): PerformanceEvent[] {
  return (rows ?? []).flatMap((row) => metrics.has(row.metric as PerformanceMetric) ? [{
    id: row.event_id,
    at: row.happened_at,
    metric: row.metric as PerformanceMetric,
    traderId: row.trader_profile_id,
    audience: row.cohort === "community" ? "community" : "founder",
  }] : []);
}

export async function getGroupPerformanceEvents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_events")
    .select("event_id, happened_at, metric, trader_profile_id, cohort")
    .order("happened_at", { ascending: true });
  return { events: error ? [] : mapPublicEvents(data), error: Boolean(error) };
}

export async function getPersonalPerformanceEvents(memberId: string) {
  const supabase = await createClient();
  const { data: trader, error: traderError } = await supabase
    .from("trader_profiles")
    .select("id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (traderError) return { events: [] as PerformanceEvent[], traderProfileId: null as string | null, error: true };
  if (trader?.id) {
    const { data, error } = await supabase
      .from("performance_events")
      .select("event_id, happened_at, metric, trader_profile_id, cohort")
      .eq("trader_profile_id", trader.id)
      .order("happened_at", { ascending: true });
    return { events: error ? [] : mapPublicEvents(data), traderProfileId: trader.id as string, error: Boolean(error) };
  }

  const [executionResult, setupPostResult] = await Promise.all([
    supabase
      .from("member_executions")
      .select("id, result, traded_at, created_at")
      .eq("member_id", memberId)
      .order("traded_at", { ascending: true }),
    supabase
      .from("posts")
      .select("id, created_at")
      .eq("author_id", memberId)
      .eq("visibility", "public")
      .eq("post_kind", "setup")
      .is("removed_at", null)
      .order("created_at", { ascending: true }),
  ]);
  const events: PerformanceEvent[] = [];
  for (const post of setupPostResult.data ?? []) {
    events.push({ id: `member-setup:${post.id}`, at: post.created_at, metric: "setup", audience: "community" });
  }
  for (const row of executionResult.data ?? []) {
    const at = row.traded_at ?? row.created_at;
    events.push({ id: `member-taken:${row.id}`, at, metric: "member_taken", audience: "community" });
    if (row.result === "win" || row.result === "loss") events.push({ id: `member-${row.result}:${row.id}`, at, metric: row.result, audience: "community" });
    else if (!row.result || row.result === "unresolved") events.push({ id: `member-open:${row.id}`, at, metric: "open", audience: "community" });
  }
  return { events, traderProfileId: null as string | null, error: Boolean(executionResult.error || setupPostResult.error) };
}
