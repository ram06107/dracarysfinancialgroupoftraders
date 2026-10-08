export const demoProfiles = [
  { name: "Range reader", field: "DEMO PROFILE / 01", style: "Waits for price to leave a defined session range and hold before forming a view.", markets: "EURUSD · GBPUSD", note: "A patient, level-first approach." },
  { name: "Macro observer", field: "DEMO PROFILE / 02", style: "Checks the calendar first and steps aside when a release changes the conditions.", markets: "EURUSD · XAUUSD", note: "Context before a chart pattern." },
  { name: "Structure mapper", field: "DEMO PROFILE / 03", style: "Marks prior turning points and looks for a pullback to hold before entry.", markets: "GBPUSD · XAUUSD", note: "Structure, then confirmation." },
  { name: "Risk-first planner", field: "DEMO PROFILE / 04", style: "Writes down the invalidation point before deciding whether an idea is worth taking.", markets: "MAJOR FX · METALS", note: "Risk is part of the setup." },
  { name: "Session reviewer", field: "DEMO PROFILE / 05", style: "Keeps short notes on what was known at the time and what only became clear later.", markets: "MAJOR FX", note: "A written process, reviewed." },
];

export const demoSetups = [
  {
    id: "demo-gold-01", trader: "Demo trader 01", instrument: "XAUUSD", direction: "SELL",
    chartVariant: "rejection" as const,
    published: "29 Sep 2026 · 11:14 EAT", status: "Closed", result: "Win", execution: "Taken",
    entry: "2,631–2,635", stop: "2,641", target: "2,620",
    context: "Example only. Price tested the prior range edge and failed to hold above it.",
    reasoning: "The short idea depended on the rejection holding. A sustained move above the marked area would invalidate the thesis.",
    review: "Compare the original premise with what price did next. Sample review text; no founder review has been supplied.",
  },
  {
    id: "demo-euro-02", trader: "Demo trader 02", instrument: "EURUSD", direction: "BUY",
    chartVariant: "breakout" as const,
    published: "01 Oct 2026 · 12:26 EAT", status: "Closed", result: "Loss", execution: "Skipped",
    entry: "1.1710–1.1720", stop: "1.1685", target: "1.1770",
    context: "Example only. Price reclaimed the overnight range before the setup was published.",
    reasoning: "The idea relied on the reclaim holding. The sample setup later failed; the execution record remains separate and says skipped.",
    review: "The level did not hold. A losing published idea and a skipped personal trade are two different records.",
  },
  {
    id: "demo-pound-03", trader: "Demo trader 03", instrument: "GBPUSD", direction: "SELL",
    chartVariant: "unresolved" as const,
    published: "02 Oct 2026 · 15:05 EAT", status: "Active", result: "Unresolved", execution: "Not recorded",
    entry: "1.3440–1.3460", stop: "1.3505", target: "Not set",
    context: "Example only. Price has pulled back toward a marked supply area.",
    reasoning: "This sample remains open. No outcome is assigned, and no execution is inferred.",
    review: "A post-trade review would be added after the setup closes.",
  },
];

export const demoPosts = [
  {
    author: "Demo trader 01", stamp: "02 Oct 2026 · 11:20 EAT",
    chartVariant: "range" as const,
    body: "DEMO THREAD — I marked the first-hour range and am waiting for a close outside it before forming a view. If price stays inside, I am leaving it alone.",
    replies: [{ author: "Demo member", body: "Would you treat a quick wick through the range as enough, or wait for the candle close?" }],
  },
  {
    author: "Demo member", stamp: "03 Oct 2026 · 10:10 EAT",
    chartVariant: "desk" as const,
    body: "DEMO QUESTION — The sample EURUSD setup shows a loss while the trader execution says “skipped”. Should those be counted as the same outcome?",
    replies: [{ author: "Demo trader 01", body: "No. The published idea, the trader’s execution and any member’s decision are separate records." }],
  },
];

export const demoReports = [
  {
    period: "22–26 SEP 2026", title: "Wait for the close", author: "Example review 01", focus: "RANGE STRUCTURE",
    body: "In this sample week, the cleaner decisions came after a candle closed outside the morning range. The first wick through it was not enough on its own. Two sessions stayed inside the range, and standing aside was part of the plan.",
    next: "Next week: mark the boundary before the session opens and record what would invalidate a break.",
  },
  {
    period: "29 SEP–03 OCT 2026", title: "The idea and the trade are separate", author: "Example review 02", focus: "EXECUTION & REVIEW",
    body: "The sample EURUSD idea ended as a loss, while its trader execution was marked skipped. Keeping those entries separate makes the thesis review useful without suggesting every reader took the same risk.",
    next: "Next week: review the entry condition and avoid inferring an outcome where none was recorded.",
  },
];

export const demoCourses = [
  { number: "01", title: "Foundations", copy: "Currency pairs, orders and the mechanics behind a market quote." },
  { number: "02", title: "Market structure", copy: "Describe swings, ranges and breaks in a method you can explain." },
  { number: "03", title: "Risk management", copy: "Plan invalidation, position risk and the decision to stand aside." },
  { number: "04", title: "Trading psychology", copy: "Review discipline and the emotional record around a decision." },
  { number: "05", title: "Strategy development", copy: "Write rules that can be tested instead of relying on a hunch." },
  { number: "06", title: "Live analysis", copy: "Read the thinking attached to a public setup example." },
];

export const demoMessages = [
  { author: "Demo student", room: "MENTOR Q&A", stamp: "02 Oct 2026 · 13:15 EAT", body: "For the range-break example, what would make you abandon the idea before entry? I have the close outside the range marked, but I am unsure how to define a failed hold." },
  { author: "Demo mentor", room: "MENTOR Q&A", stamp: "02 Oct 2026 · 13:38 EAT", body: "Write the condition down before the next candle forms. For this exercise, a close back inside the range would invalidate the hold. That is an example rule; use the plan that fits your method." },
  { author: "Demo student", room: "STUDENT ANALYSIS", stamp: "02 Oct 2026 · 14:02 EAT", body: "I left the entry blank because price never returned to the level. The idea stayed on the record, but there was no fill in this example." },
];

export const demoJournal = [
  { instrument: "EURUSD", date: "01 Oct 2026", risk: "Idea invalid below the marked range; no size assumed.", lesson: "A skipped setup is not a missed result.", body: "The reclaim looked constructive, but the setup later failed. In this example I marked it as skipped, so the public setup result and my personal execution stay separate." },
  { instrument: "XAUUSD", date: "29 Sep 2026", risk: "Stop idea sat beyond the prior swing.", lesson: "Wait for the level to hold before deciding.", body: "Price rejected the upper edge of the range. The short thesis depended on that rejection holding; acceptance above the area would invalidate it." },
];
