import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { createDemoPerformanceEvents, demoTraderIds } from "@/lib/performance";
import { getGroupPerformanceEvents } from "@/lib/performance-live";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const connected = hasSupabaseConfig();
  const [live, roster] = connected ? await Promise.all([
    getGroupPerformanceEvents(),
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase.from("public_trader_performance").select("trader_profile_id, public_name").order("public_name", { ascending: true });
      return { traders: (data ?? []).map((row) => ({ id: row.trader_profile_id, name: row.public_name })), error: Boolean(error) };
    })(),
  ]) : [null, null] as const;
  const events = connected ? live?.events ?? [] : createDemoPerformanceEvents();
  const demoNames = ["Range reader", "Macro observer", "Structure mapper", "Risk-first planner", "Session reviewer"];
  const traders = connected ? roster?.traders ?? [] : demoTraderIds.map((id, index) => ({ id, name: demoNames[index] }));
  return <section className="demo-page analytics-page">
    <div className="demo-page-head"><p className="eyebrow eyebrow-dark">GROUP PERFORMANCE / PUBLIC RECORD</p><h1>See the record<br /><em>from every angle.</em></h1><p>Follow shared ideas, recorded executions and outcomes over time. Each view shows what the data can support without implying returns.</p></div>
    {!connected ? <div className="demo-notice"><strong>DEMO DATA</strong><span>Fictional trader and performance examples are shown for observation. No live member activity is connected.</span></div> : live?.error || roster?.error ? <div className="performance-connection-note"><strong>Live analytics are not ready.</strong><span>Apply the performance migration and publish records to fill these charts with live data.</span></div> : null}
    <AnalyticsDashboard events={events} traders={traders} connected={connected} />
    <aside className="performance-transparency-note"><strong>HOW THE COUNTS WORK</strong><p>Published setups and trader executions are separate records. Member execution totals appear only as daily aggregates when at least five members have opted in. No individual member trade is shown.</p><p>Win and loss counts reflect recorded setup outcomes. This dashboard does not calculate returns, account balances or risk-adjusted performance.</p></aside>
  </section>;
}
