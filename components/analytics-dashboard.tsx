"use client";

import { useMemo, useState } from "react";
import { buildPerformanceSeries, periodLabels, summarizePerformance, type PerformanceEvent, type PerformancePeriod, type PerformancePoint } from "@/lib/performance";

type Trader = { id: string; name: string };
type MetricKey = "setups" | "founderTaken" | "memberTaken" | "wins" | "losses" | "open";

const seriesColors: Record<MetricKey, string> = {
  setups: "#438de8", founderTaken: "#b85d42", memberTaken: "#72866e", wins: "#72866e", losses: "#bd6a50", open: "#c0a66e",
};

const metricNames: Record<MetricKey, string> = {
  setups: "Published setups", founderTaken: "Trader trades taken", memberTaken: "Community trades taken", wins: "Wins", losses: "Losses", open: "Open",
};

const n = (value: number) => new Intl.NumberFormat("en-GB").format(value);

function ActivityChart({ points }: { points: PerformancePoint[] }) {
  const width = 780, height = 255, left = 42, right = 12, top = 18, bottom = 36;
  const max = Math.max(4, ...points.flatMap((p) => [p.setups, p.founderTaken, p.memberTaken]));
  const x = (i: number) => left + (points.length < 2 ? 0 : i * (width - left - right) / (points.length - 1));
  const y = (v: number) => top + (max - v) * (height - top - bottom) / max;
  const lines: MetricKey[] = ["setups", "founderTaken", "memberTaken"];
  const labels = new Set([0, Math.round((points.length - 1) / 4), Math.round((points.length - 1) / 2), Math.round((points.length - 1) * 3 / 4), points.length - 1]);
  const chartPath = (key: MetricKey) => {
    const coords = points.map((point, index) => ({ x: x(index), y: y(point[key]) }));
    if (!coords.length) return "";
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
    return coords.slice(0, -1).reduce((path, current, index) => {
      const next = coords[index + 1];
      const previous = coords[Math.max(0, index - 1)];
      const after = coords[Math.min(coords.length - 1, index + 2)];
      const c1x = current.x + (next.x - previous.x) / 6;
      const c1y = current.y + (next.y - previous.y) / 6;
      const c2x = next.x - (after.x - current.x) / 6;
      const c2y = next.y - (after.y - current.y) / 6;
      return `${path} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${next.x} ${next.y}`;
    }, `M ${coords[0].x} ${coords[0].y}`);
  };
  const area = `${chartPath("setups")} L ${x(points.length - 1)} ${height - bottom} L ${x(0)} ${height - bottom} Z`;
  const hasActivity = points.some((point) => point.setups || point.founderTaken || point.memberTaken);
  return <svg className="insight-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Area and line chart of setups and executions over time">
    {[0, 1, 2, 3, 4].map((tick) => { const value = Math.round(max * (4 - tick) / 4); return <g key={tick}><line className="insight-gridline" x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text className="insight-axis" x={left - 9} y={y(value) + 3} textAnchor="end">{value}</text></g>; })}
    <defs><linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#438de8" stopOpacity=".25" /><stop offset="1" stopColor="#438de8" stopOpacity=".015" /></linearGradient></defs>
    {hasActivity && <path d={area} fill="url(#activity-fill)" />}
    {hasActivity && lines.map((key) => <g key={key}><path className={`insight-series insight-series-${key}`} d={chartPath(key)} fill="none" stroke={seriesColors[key]} strokeWidth={key === "setups" ? 3.2 : 2.4} strokeLinejoin="round" strokeLinecap="round" />{points.map((p, i) => p[key] ? <circle key={p.key} cx={x(i)} cy={y(p[key])} r={key === "setups" ? 4 : 3} fill={seriesColors[key]} stroke="#fbfaf7" strokeWidth="2"><title>{`${p.label}: ${metricNames[key]}: ${p[key]}`}</title></circle> : null)}</g>)}
    {!hasActivity && <text className="insight-empty-label" x={(left + width - right) / 2} y={(top + height - bottom) / 2} textAnchor="middle">No recorded activity in this period</text>}
    {points.map((p, i) => labels.has(i) ? <text key={p.key} className="insight-axis" x={x(i)} y={height - 11} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>{p.label}</text> : null)}
  </svg>;
}

function OutcomesChart({ points }: { points: PerformancePoint[] }) {
  const width = 680, height = 260, left = 36, right = 10, top = 17, bottom = 38;
  const max = Math.max(1, ...points.map((p) => p.memberWins + p.memberLosses + p.memberOpen));
  const slot = (width - left - right) / points.length;
  const barWidth = Math.min(25, slot * .55);
  const plotHeight = height - top - bottom;
  const labels = new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1]);
  return <svg className="insight-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Stacked column chart of winning, losing and open setups">
    {[0, 1, 2, 3, 4].map((tick) => { const value = Math.round(max * (4 - tick) / 4); const yy = top + plotHeight * tick / 4; return <g key={tick}><line className="insight-gridline" x1={left} x2={width - right} y1={yy} y2={yy} /><text className="insight-axis" x={left - 8} y={yy + 3} textAnchor="end">{value}</text></g>; })}
    {points.map((p, i) => { const total = p.memberWins + p.memberLosses + p.memberOpen; const x = left + i * slot + (slot - barWidth) / 2; let y = height - bottom; const sections: [MetricKey, number][] = [["wins", p.memberWins], ["losses", p.memberLosses], ["open", p.memberOpen]]; return <g key={p.key}>{sections.map(([key, value]) => { const h = value / max * plotHeight; y -= h; return <rect key={key} x={x} y={y} width={barWidth} height={Math.max(0, h)} fill={seriesColors[key]} rx="1"><title>{`${p.label}: ${metricNames[key]} ${value}`}</title></rect>; })}{labels.has(i) && <text className="insight-axis" x={x + barWidth / 2} y={height - 11} textAnchor="middle">{p.label}</text>}{total === 0 && null}</g>; })}
  </svg>;
}

function OutcomeDonut({ totals }: { totals: { wins: number; losses: number; open: number } }) {
  const values: { key: MetricKey; label: string; value: number }[] = [{ key: "wins", label: "Won", value: totals.wins }, { key: "losses", label: "Lost", value: totals.losses }, { key: "open", label: "Open", value: totals.open }];
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const radius = 58, stroke = 20, circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="outcome-donut-layout"><svg className="outcome-donut" viewBox="0 0 170 170" role="img" aria-label={`${totals.wins} wins, ${totals.losses} losses, ${totals.open} open`}>
    <circle cx="85" cy="85" r={radius} fill="none" stroke="#e9e6de" strokeWidth={stroke} />
    {values.map((item) => { const length = total ? item.value / total * circumference : 0; const circle = <circle key={item.key} cx="85" cy="85" r={radius} fill="none" stroke={seriesColors[item.key]} strokeWidth={stroke} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 85 85)"><title>{`${item.label}: ${item.value}`}</title></circle>; offset += length; return circle; })}
    <text x="85" y="81" textAnchor="middle" className="donut-total">{n(total)}</text><text x="85" y="99" textAnchor="middle" className="donut-caption">OUTCOMES</text>
  </svg><div className="outcome-legend">{values.map((item) => <div key={item.key}><span><i style={{ background: seriesColors[item.key] }} />{item.label}</span><strong>{n(item.value)}</strong><small>{total ? Math.round(item.value / total * 100) : 0}%</small></div>)}<p>Closed setups only are used for win rate.</p></div></div>;
}

function TraderBars({ events, traders }: { events: PerformanceEvent[]; traders: Trader[] }) {
  const rows = traders.map((trader) => {
    const traderEvents = events.filter((event) => event.traderId === trader.id);
    const summary = summarizePerformance(traderEvents);
    return { ...trader, summary };
  }).sort((a, b) => b.summary.setups - a.summary.setups || a.name.localeCompare(b.name)).slice(0, 5);
  const max = Math.max(1, ...rows.map((row) => row.summary.setups));
  return <div className="leaderboard-bars">{rows.length ? rows.map((row, index) => <div className="leaderboard-row" key={row.id}><span className="leaderboard-rank">{String(index + 1).padStart(2, "0")}</span><div className="leaderboard-main"><div className="leaderboard-name"><strong>{row.name}</strong><span>{row.summary.setups} setups · {row.summary.founderTaken} taken</span></div><div className="leaderboard-track"><i style={{ width: `${row.summary.setups / max * 100}%` }} /></div><div className="leaderboard-outcomes"><span><i className="leaderboard-win" />{row.summary.wins} won</span><span><i className="leaderboard-loss" />{row.summary.losses} lost</span><span>{row.summary.open} open</span></div></div><strong className="leaderboard-score">{row.summary.setups}</strong></div>) : <p className="analytics-empty">Trader activity will appear when public records are added.</p>}</div>;
}

export function AnalyticsDashboard({ events, traders, connected }: { events: PerformanceEvent[]; traders: Trader[]; connected: boolean }) {
  const [period, setPeriod] = useState<PerformancePeriod>("monthly");
  const points = useMemo(() => buildPerformanceSeries(events, period), [events, period]);
  const totals = useMemo(() => points.reduce((result, point) => ({
    setups: result.setups + point.setups, founderTaken: result.founderTaken + point.founderTaken, memberTaken: result.memberTaken + point.memberTaken,
    founderWins: result.founderWins + point.founderWins, founderLosses: result.founderLosses + point.founderLosses, founderOpen: result.founderOpen + point.founderOpen,
    memberWins: result.memberWins + point.memberWins, memberLosses: result.memberLosses + point.memberLosses, memberOpen: result.memberOpen + point.memberOpen,
  }), { setups: 0, founderTaken: 0, memberTaken: 0, founderWins: 0, founderLosses: 0, founderOpen: 0, memberWins: 0, memberLosses: 0, memberOpen: 0 }), [points]);
  const rangeStart = points[0]?.key ?? "";
  const rangeEnd = new Date().toISOString();
  const periodEvents = events.filter((event) => event.at.slice(0, 10) >= rangeStart && event.at <= rangeEnd);
  const communityClosed = totals.memberWins + totals.memberLosses;
  const cards: [string, number, string][] = [
    ["SETUPS PUBLISHED", totals.setups, "Ideas added to the public record"],
    ["TRADER TRADES TAKEN", totals.founderTaken, "Recorded trader executions"],
    ["COMMUNITY EXECUTIONS", totals.memberTaken, "Anonymous opt-in aggregate"],
    ["TRADER SETUPS WON", totals.founderWins, "Outcome recorded on a published setup"],
    ["TRADER SETUPS LOST", totals.founderLosses, "Outcome recorded on a published setup"],
    ["COMMUNITY WIN RATE", communityClosed ? Math.round(totals.memberWins / communityClosed * 100) : 0, `${communityClosed} resolved member executions`],
  ];
  const periodCount = period === "daily" ? "14 DAYS" : period === "yearly" ? "5 YEARS" : "12 PERIODS";
  return <section className="analytics-board" aria-label="Group performance analytics">
    <div className="analytics-board-head"><div><p className="eyebrow eyebrow-dark">PERIOD SUMMARY</p><h2>Activity with context.</h2><p>Published ideas, recorded executions and outcomes, grouped by the date they happened.</p></div><div className="performance-periods" role="tablist" aria-label="Choose analytics period">{(Object.keys(periodLabels) as PerformancePeriod[]).map((key) => <button type="button" key={key} role="tab" aria-selected={period === key} className={period === key ? "performance-period-active" : ""} onClick={() => setPeriod(key)}>{periodLabels[key]}</button>)}</div></div>
    <div className="analytics-kpis">{cards.map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{label === "COMMUNITY WIN RATE" ? `${value}%` : n(value)}</strong><small>{note}</small></article>)}</div>
    <div className="analytics-chart-grid">
      <article className="analytics-chart-card analytics-chart-wide"><div className="analytics-card-head"><div><span>PUBLIC RECORD / ACTIVITY</span><h3>Ideas and participation over time</h3></div><small>{periodCount}</small></div><ActivityChart points={points} /><div className="analytics-legend">{(["setups", "founderTaken", "memberTaken"] as MetricKey[]).map((key) => <span key={key}><i style={{ background: seriesColors[key] }} />{metricNames[key]}</span>)}</div></article>
      <article className="analytics-chart-card"><div className="analytics-card-head"><div><span>TRADER SETUPS / {periodLabels[period].toUpperCase()}</span><h3>Published setup outcomes</h3></div></div><OutcomeDonut totals={{ wins: totals.founderWins, losses: totals.founderLosses, open: totals.founderOpen }} /></article>
      <article className="analytics-chart-card analytics-chart-wide"><div className="analytics-card-head"><div><span>COMMUNITY EXECUTIONS / ACTIVITY</span><h3>Member recorded outcomes</h3></div><small>{periodCount}</small></div><OutcomesChart points={points} /><div className="analytics-legend">{([["wins", "Community wins"], ["losses", "Community losses"], ["open", "Community open"]] as [MetricKey, string][]).map(([key, label]) => <span key={key}><i style={{ background: seriesColors[key] }} />{label}</span>)}</div></article>
      <article className="analytics-chart-card"><div className="analytics-card-head"><div><span>APPROVED TRADERS / PUBLIC RECORD</span><h3>Most active this period</h3></div></div><TraderBars events={periodEvents} traders={traders} /></article>
    </div>
    <p className="analytics-data-note">{connected ? "Live public records" : "Fictional demo records"} · Trader setup outcomes and community execution outcomes are shown separately. Community execution figures appear only as privacy protected aggregates; performance counts do not imply returns.</p>
  </section>;
}
