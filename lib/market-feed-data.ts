import type { DemoChartVariant } from "@/components/demo-chart-image";

export type MarketFeedTopic = "weekly-analysis" | "market-life";

export type MarketFeedPost = {
  id: string;
  topic: MarketFeedTopic;
  label: string;
  market: string;
  title: string;
  author: string;
  published: string;
  readingTime: string;
  excerpt: string;
  note: string;
  chartVariant: DemoChartVariant;
};

export const demoMarketPosts: MarketFeedPost[] = [
  {
    id: "weekly-range-close",
    chartVariant: "range",
    topic: "weekly-analysis",
    label: "Weekly analysis",
    market: "EURUSD",
    title: "A break is only useful if it can hold",
    author: "Mara K.",
    published: "03 Oct 2026",
    readingTime: "1 min read",
    excerpt: "Early in the week, EURUSD kept circling its opening range. The useful question was not where a breakout might go, but what would count as acceptance outside the range.",
    note: "Next week, I’ll mark the range before the session and write down what would invalidate a break before looking for an entry.",
  },
  {
    id: "gold-level-review",
    chartVariant: "rejection",
    topic: "weekly-analysis",
    label: "Weekly analysis",
    market: "XAUUSD",
    title: "The level mattered less than the close",
    author: "Joel A.",
    published: "02 Oct 2026",
    readingTime: "1 min read",
    excerpt: "A quick wick through the marked area made the chart look decisive. The close told a quieter story: price had not held beyond the level, so I left the idea open for another check.",
    note: "A level is a place to ask a question. It is not, by itself, an answer or a trade instruction.",
  },
  {
    id: "pound-weekly-review",
    chartVariant: "unresolved",
    topic: "weekly-analysis",
    label: "Weekly analysis",
    market: "GBPUSD",
    title: "What stayed unresolved into Friday",
    author: "Asha N.",
    published: "02 Oct 2026",
    readingTime: "1 min read",
    excerpt: "Friday came around and the idea was still open. Rather than force a neat ending into the weekly note, I’m leaving the outcome unresolved and writing down what would change my view.",
    note: "I’ll revisit the condition after the next full session rather than fill in a result early.",
  },
  {
    id: "chart-markup-humor",
    chartVariant: "desk",
    topic: "market-life",
    label: "Market life",
    market: "DESK NOTES",
    title: "Nine trendlines, one chart, and no clear answer",
    author: "Sam T.",
    published: "01 Oct 2026",
    readingTime: "1 min read",
    excerpt: "My chart started with one clean level. By noon it looked like a map of every road I have ever missed. I removed anything I could not explain in one sentence.",
    note: "The redraw took two minutes. The coffee took longer. Both were useful parts of the process.",
  },
  {
    id: "calendar-coffee",
    chartVariant: "desk",
    topic: "market-life",
    label: "Market life",
    market: "OFF THE CHART",
    title: "The economic calendar has a coffee schedule",
    author: "Kemi R.",
    published: "30 Sep 2026",
    readingTime: "1 min read",
    excerpt: "Some mornings the most disciplined market decision is checking the calendar, noticing a busy hour, and taking a quiet break before it starts.",
    note: "No chart lesson today. Just a reminder that stepping away can be part of a routine too.",
  },
];
