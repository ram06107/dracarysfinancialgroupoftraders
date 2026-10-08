import type { Metadata } from "next";
import Link from "next/link";
import { createDemoPerformanceEvents, demoTraderIds, summarizePerformance } from "@/lib/performance";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "The Traders" };

type Trader = { trader_profile_id: string; member_id: string; slug: string; public_name: string; trading_style: string; experience_summary: string; markets: string[]; setups: number; taken: number; wins: number; losses: number; open: number };

function TraderCard({ trader, href }: { trader: Trader; href?: string }) {
  const content = <>
    <div className="trader-performance-card-head"><span className="trader-profile-mark">{trader.public_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><span className="trader-profile-label">PUBLIC TRADER RECORD</span><h2>{trader.public_name}</h2></div></div>
    <p className="trader-performance-style">{trader.trading_style || "No trading approach has been added yet."}</p>
    {trader.markets.length > 0 && <div className="trader-market-list">{trader.markets.map((market) => <span key={market}>{market}</span>)}</div>}
    <div className="trader-performance-stats"><div><strong>{trader.setups}</strong><span>SETUPS</span></div><div><strong>{trader.taken}</strong><span>TAKEN</span></div><div><strong>{trader.wins}</strong><span>WINS</span></div><div><strong>{trader.losses}</strong><span>LOSSES</span></div><div><strong>{trader.open}</strong><span>OPEN</span></div></div>
    <p className="trader-performance-foot">Outcomes and executions are published separately. No return is inferred.</p>
  </>;
  return <article className="trader-performance-card">{href ? <Link href={href} className="trader-card-link">{content}</Link> : content}</article>;
}

function demoTraders(): Trader[] {
  const events = createDemoPerformanceEvents();
  const people = [
    ["Range reader", "Waits for price to leave a defined session range and hold before forming a view.", ["EURUSD", "GBPUSD"]],
    ["Macro observer", "Checks the calendar first and steps aside when a release changes the conditions.", ["EURUSD", "XAUUSD"]],
    ["Structure mapper", "Marks prior turning points and looks for a pullback to hold before entry.", ["GBPUSD", "XAUUSD"]],
    ["Risk-first planner", "Writes down invalidation before deciding whether an idea is worth taking.", ["MAJOR FX", "METALS"]],
    ["Session reviewer", "Keeps short notes on what was known at the time and what changed later.", ["MAJOR FX"]],
  ] as const;
  return people.map(([public_name, trading_style, markets], index) => {
    const summary = summarizePerformance(events.filter((event) => event.traderId === demoTraderIds[index]));
    return { trader_profile_id: demoTraderIds[index], member_id: "", slug: "", public_name, trading_style, experience_summary: "", markets: [...markets], setups: summary.setups, taken: summary.founderTaken, wins: summary.wins, losses: summary.losses, open: summary.open };
  });
}

export default async function TradersPage() {
  const connected = hasSupabaseConfig();
  let traders: Trader[] = [];
  let failed = false;
  if (connected) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("public_trader_performance").select("trader_profile_id, member_id, slug, public_name, trading_style, experience_summary, markets, setups, taken, wins, losses, open").order("public_name", { ascending: true });
    failed = Boolean(error);
    traders = (data ?? []) as Trader[];
  } else {
    traders = demoTraders();
  }
  return <section className="demo-page trader-transparency-page">
    <div className="demo-page-head"><p className="eyebrow eyebrow-dark">TRADERS / PUBLIC RECORD</p><h1>Judge the work<br /><em>by the whole record.</em></h1><p>See each trader’s published setups alongside what they recorded as taken, won, lost or still open.</p></div>
    {!connected && <div className="demo-notice"><strong>DEMO DATA</strong><span>Fictional trader names and performance examples. These are not biographies or live trading results.</span></div>}
    {failed && <div className="performance-connection-note"><strong>Live trader records are not available.</strong><span>Apply the performance migration and publish trader profiles to list their records here.</span></div>}
    {!failed && traders.length === 0 && connected && <div className="trader-empty-state"><strong>No traders have published a record yet.</strong><span>When a trader profile and setup are published, the complete record will appear here.</span></div>}
    <div className="trader-transparency-intro"><span>OPEN RECORDS</span><p>Setup ideas stay visible after closure. Execution numbers are not inferred from a published signal, and private member activity is excluded.</p><Link href="/analytics">View group performance <span aria-hidden="true"></span></Link></div>
    <div className="trader-performance-grid">{traders.map((trader) => <TraderCard key={trader.trader_profile_id} trader={trader} href={connected ? `/members/${trader.member_id}` : undefined} />)}</div>
  </section>;
}
