export type PerformanceMetric = "setup" | "founder_taken" | "member_taken" | "win" | "loss" | "open";
export type PerformanceEvent = { id: string; at: string; metric: PerformanceMetric; traderId?: string | null; audience?: "founder" | "community" };
export type PerformancePeriod = "daily" | "weekly" | "monthly" | "yearly";
export type PerformancePoint = { key: string; label: string; setups: number; founderTaken: number; memberTaken: number; wins: number; losses: number; open: number; founderWins: number; founderLosses: number; founderOpen: number; memberWins: number; memberLosses: number; memberOpen: number };

export const periodLabels: Record<PerformancePeriod, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
export const demoTraderIds = ["demo-trader-1", "demo-trader-2", "demo-trader-3", "demo-trader-4", "demo-trader-5"] as const;

function startOf(date: Date, period: PerformancePeriod) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (period === "daily") return value;
  if (period === "weekly") {
    value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
    return value;
  }
  if (period === "monthly") return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  return new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
}

function shift(date: Date, period: PerformancePeriod, amount: number) {
  const value = new Date(date);
  if (period === "daily") value.setUTCDate(value.getUTCDate() + amount);
  else if (period === "weekly") value.setUTCDate(value.getUTCDate() + amount * 7);
  else if (period === "monthly") value.setUTCMonth(value.getUTCMonth() + amount);
  else value.setUTCFullYear(value.getUTCFullYear() + amount);
  return value;
}

function pointLabel(date: Date, period: PerformancePeriod) {
  if (period === "daily") return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(date);
  if (period === "weekly") return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  if (period === "monthly") return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
  return String(date.getUTCFullYear());
}

export function buildPerformanceSeries(events: PerformanceEvent[], period: PerformancePeriod, now = new Date()): PerformancePoint[] {
  const count = period === "daily" ? 14 : period === "weekly" || period === "monthly" ? 12 : 5;
  const current = startOf(now, period);
  const starts = Array.from({ length: count }, (_, index) => shift(current, period, index - count + 1));
  const points = starts.map((date) => ({
    key: date.toISOString().slice(0, 10), label: pointLabel(date, period),
    setups: 0, founderTaken: 0, memberTaken: 0, wins: 0, losses: 0, open: 0,
    founderWins: 0, founderLosses: 0, founderOpen: 0, memberWins: 0, memberLosses: 0, memberOpen: 0,
  }));
  const keys = new Map(points.map((point, index) => [point.key, index]));
  for (const event of events) {
    const date = new Date(event.at);
    if (Number.isNaN(date.getTime())) continue;
    const key = startOf(date, period).toISOString().slice(0, 10);
    const index = keys.get(key);
    if (index === undefined) continue;
    const point = points[index];
    if (event.metric === "setup") point.setups += 1;
    else if (event.metric === "founder_taken") point.founderTaken += 1;
    else if (event.metric === "member_taken") point.memberTaken += 1;
    else if (event.metric === "win") {
      point.wins += 1;
      if (event.audience === "community") point.memberWins += 1; else point.founderWins += 1;
    } else if (event.metric === "loss") {
      point.losses += 1;
      if (event.audience === "community") point.memberLosses += 1; else point.founderLosses += 1;
    } else {
      point.open += 1;
      if (event.audience === "community") point.memberOpen += 1; else point.founderOpen += 1;
    }
  }
  return points;
}

export function summarizePerformance(events: PerformanceEvent[]) {
  return events.reduce((total, event) => {
    if (event.metric === "setup") total.setups += 1;
    if (event.metric === "founder_taken") total.founderTaken += 1;
    if (event.metric === "member_taken") total.memberTaken += 1;
    if (event.metric === "win") {
      total.wins += 1;
      if (event.audience === "community") total.memberWins += 1; else total.founderWins += 1;
    }
    if (event.metric === "loss") {
      total.losses += 1;
      if (event.audience === "community") total.memberLosses += 1; else total.founderLosses += 1;
    }
    if (event.metric === "open") {
      total.open += 1;
      if (event.audience === "community") total.memberOpen += 1; else total.founderOpen += 1;
    }
    return total;
  }, { setups: 0, founderTaken: 0, memberTaken: 0, wins: 0, losses: 0, open: 0, founderWins: 0, founderLosses: 0, founderOpen: 0, memberWins: 0, memberLosses: 0, memberOpen: 0 });
}

export function createDemoPerformanceEvents(anchor = new Date()): PerformanceEvent[] {
  const offsets = [0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 17, 20, 23, 27, 31, 37, 45, 54, 63, 73, 84, 96, 109, 124, 140, 157, 177, 197, 220, 243, 270, 300, 330, 365, 400, 440, 480, 525, 575, 630, 690, 760, 840, 940, 1060, 1200, 1365, 1530, 1710];
  const events: PerformanceEvent[] = [];
  offsets.forEach((daysAgo, index) => {
    const date = new Date(anchor);
    date.setUTCHours(11, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    const traderId = demoTraderIds[index % demoTraderIds.length];
    const stamp = date.toISOString();
    events.push({ id: `sample-setup-${index}`, at: stamp, metric: "setup", traderId, audience: "founder" });
    if (index % 5 === 0) events.push({ id: `sample-open-${index}`, at: stamp, metric: "open", traderId, audience: "founder" });
    else if (index % 4 === 0 || index % 4 === 1) events.push({ id: `sample-win-${index}`, at: stamp, metric: "win", traderId, audience: "founder" });
    else events.push({ id: `sample-loss-${index}`, at: stamp, metric: "loss", traderId, audience: "founder" });
    if (index % 3 !== 0) events.push({ id: `sample-founder-taken-${index}`, at: stamp, metric: "founder_taken", traderId, audience: "founder" });
    if (index % 4 === 1) {
      events.push({ id: `sample-member-taken-${index}`, at: stamp, metric: "member_taken", audience: "community" });
      const memberOutcome: PerformanceMetric = index % 3 === 1 ? "win" : index % 3 === 2 ? "loss" : "open";
      events.push({ id: `sample-member-${memberOutcome}-${index}`, at: stamp, metric: memberOutcome, audience: "community" });
    }
  });
  return events;
}
