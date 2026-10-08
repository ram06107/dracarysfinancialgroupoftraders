"use client";

import { useMemo, useState } from "react";
import { buildPerformanceSeries, periodLabels, type PerformanceEvent, type PerformancePeriod, type PerformancePoint } from "@/lib/performance";

type LineKey = "setups" | "founderTaken" | "memberTaken" | "wins" | "losses";
const lineStyles: Record<LineKey, { label: string; color: string }> = {
  setups: { label: "Setups published", color: "#222722" },
  founderTaken: { label: "Trader trades taken", color: "#b85d42" },
  memberTaken: { label: "Member trades taken", color: "#788b72" },
  wins: { label: "Wins", color: "#8caa86" },
  losses: { label: "Losses", color: "#c47a62" },
};

function Chart({ points, lines }: { points: PerformancePoint[]; lines: LineKey[] }) {
  const width = 820, height = 286, left = 48, right = 14, top = 17, bottom = 40;
  const max = Math.max(4, ...points.flatMap((point) => lines.map((line) => point[line])));
  const x = (index: number) => left + (points.length <= 1 ? 0 : index * (width - left - right) / (points.length - 1));
  const y = (value: number) => top + (max - value) * (height - top - bottom) / max;
  const ticks = 4;
  const labelIndices = new Set([0, Math.floor((points.length - 1) / 4), Math.floor((points.length - 1) / 2), Math.floor((points.length - 1) * 3 / 4), points.length - 1]);
  return <figure className="performance-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart of setups, recorded executions, wins and losses for the selected period">
      <title>Trading activity over time</title>
      <desc>Counts are grouped by the date each setup or execution was recorded. No profit or return is inferred.</desc>
      {Array.from({ length: ticks + 1 }, (_, index) => {
        const value = Math.round(max * (ticks - index) / ticks);
        const lineY = y(value);
        return <g key={index}><line x1={left} x2={width - right} y1={lineY} y2={lineY} className="performance-grid-line" /><text x={left - 11} y={lineY + 3} textAnchor="end" className="performance-axis-label">{value}</text></g>;
      })}
      {lines.map((line) => {
        const coords = points.map((point, index) => `${x(index)},${y(point[line])}`).join(" ");
        return <g key={line}><polyline points={coords} fill="none" stroke={lineStyles[line].color} strokeWidth={line === "setups" ? 2.6 : 2.2} strokeLinejoin="round" strokeLinecap="round" />{points.map((point, index) => point[line] ? <circle key={`${line}-${point.key}`} cx={x(index)} cy={y(point[line])} r="2.6" fill={lineStyles[line].color}><title>{point.label}: {lineStyles[line].label}: {point[line]}</title></circle> : null)}</g>;
      })}
      {points.map((point, index) => labelIndices.has(index) ? <text key={point.key} x={x(index)} y={height - 13} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="performance-axis-label">{point.label}</text> : null)}
    </svg>
  </figure>;
}

export function PerformanceDashboard({ events, scope = "personal", accountKind = "trader", title, subtitle }: { events: PerformanceEvent[]; scope?: "personal" | "group"; accountKind?: "trader" | "member"; title?: string; subtitle?: string }) {
  const [period, setPeriod] = useState<PerformancePeriod>("monthly");
  const points = useMemo(() => buildPerformanceSeries(events, period), [events, period]);
  const totals = useMemo(() => points.reduce((total, point) => ({
    setups: total.setups + point.setups,
    founderTaken: total.founderTaken + point.founderTaken,
    memberTaken: total.memberTaken + point.memberTaken,
    wins: total.wins + point.wins,
    losses: total.losses + point.losses,
    open: total.open + point.open,
  }), { setups: 0, founderTaken: 0, memberTaken: 0, wins: 0, losses: 0, open: 0 }), [points]);
  const lines: LineKey[] = scope === "group" ? ["setups", "founderTaken", "memberTaken", "wins", "losses"] : accountKind === "member" ? ["setups", "memberTaken", "wins", "losses"] : ["setups", "founderTaken", "wins", "losses"];
  const stats = scope === "group" ? [
    ["TOTAL SETUPS", totals.setups, "Published to the public record"],
    ["TRADERS TOOK", totals.founderTaken, "Public execution entries"],
    ["MEMBERS TOOK", totals.memberTaken, "Opt-in totals, privacy protected"],
    ["WON SETUPS", totals.wins, "Recorded winning outcomes"],
    ["LOST SETUPS", totals.losses, "Recorded losing outcomes"],
  ] as const : accountKind === "member" ? [
    ["SETUPS SHARED", totals.setups, "Your published community setups"],
    ["TRADES LOGGED", totals.memberTaken, "Your private execution journal"],
    ["WON", totals.wins, "Recorded outcomes"],
    ["LOST", totals.losses, "Kept in your record"],
    ["OPEN", totals.open, "No outcome assigned"],
  ] as const : [
    ["MY SETUPS", totals.setups, "Published or recorded by you"],
    ["TAKEN", totals.founderTaken + totals.memberTaken, scope === "personal" ? "Your recorded executions" : "Recorded executions"],
    ["WON", totals.wins, "Recorded outcomes"],
    ["LOST", totals.losses, "Kept in the record"],
    ["OPEN", totals.open, "No outcome assigned"],
  ] as const;
  const heading = title ?? (scope === "group" ? "The whole desk, in view." : "Your trading record.");
  return <section className={`performance-panel performance-panel-${scope}`}>
    <div className="performance-panel-head"><div><p className="eyebrow eyebrow-dark">{scope === "group" ? "GENERAL PERFORMANCE" : "PERSONAL PERFORMANCE"}</p><h2>{heading}</h2><p>{subtitle ?? (scope === "group" ? "Published setups and recorded outcomes across the group." : "A clear view of what you published, took and reviewed.")}</p></div><div className="performance-periods" role="tablist" aria-label="Choose chart period">{(Object.keys(periodLabels) as PerformancePeriod[]).map((key) => <button type="button" key={key} role="tab" aria-selected={period === key} className={period === key ? "performance-period-active" : ""} onClick={() => setPeriod(key)}>{periodLabels[key]}</button>)}</div></div>
    <div className="performance-stats">{stats.map(([label, value, note]) => <article className="performance-stat" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <article className="performance-graph-card"><div className="performance-graph-head"><div><span className="performance-card-kicker">ACTIVITY / {periodLabels[period].toUpperCase()}</span><h3>Records over time</h3></div><span className="performance-range">{period === "daily" ? "14 DAYS" : period === "weekly" || period === "monthly" ? "12 PERIODS" : "5 YEARS"}</span></div><Chart points={points} lines={lines} /><div className="performance-legend">{lines.map((line) => <span key={line}><i style={{ backgroundColor: lineStyles[line].color }} />{lineStyles[line].label}</span>)}</div><p className="performance-method">Counts come from dated records. A published setup and a trader execution are counted separately. This chart does not estimate profit or return.</p></article>
  </section>;
}
