import type { Metadata } from "next";
import Link from "next/link";
import { MarketSocialFeed } from "@/components/market-social-feed";
import { getCommunityFeed } from "@/lib/community/feed";
import { getDemoRole } from "@/lib/demo-session";

export const metadata: Metadata = { title: "Market feed" };

export default async function MarketFeedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [feed, role, query] = await Promise.all([getCommunityFeed(), getDemoRole(), searchParams]);
  const founderDemo = role === "founder";
  const demoMember = role === "member";
  const signedIn = feed.connected ? feed.signedIn : Boolean(role);
  const name = feed.connected ? feed.member?.public_name ?? "Member" : founderDemo ? "Founder Trader" : demoMember ? "Demo Member" : "Member";
  return <section className="market-feed-page social-feed-page" aria-label="Market feed">
    <section className="market-feed-head">
      <div><p className="eyebrow eyebrow-dark">THE MARKET FEED</p><h1>Markets, in<br /><em>their own words.</em></h1><p>Short updates, chart notes and longer weekly analysis from the desk.</p></div>
      <Link className="feed-discussion-link" href="/community"><span>For back-and-forth conversation</span><strong>Open the community <span aria-hidden="true"></span></strong></Link>
    </section>
    {query.error === "post" && <p className="status-note status-error" role="status">That post could not be published. Check the text and attachment, then try again.</p>}
    {query.error === "trader_only" && <p className="status-note status-error" role="status">Only approved DRACARYS Financial Traders can publish feed posts. Public Members can comment here and post freely in the Community group chat.</p>}
    {query.posted && <p className="status-note" role="status">Your post is up.</p>}
    {feed.connected && "failed" in feed && feed.failed && <div className="performance-connection-note"><strong>The live feed is taking a moment.</strong><span>Refresh this page shortly. Nothing has been filled in on your behalf.</span></div>}
    {!feed.connected && <div className="demo-notice"><strong>DEMO DATA</strong><span>Sample posts are fictional. New posts and interactions in this preview stay in this browser.</span></div>}
    <MarketSocialFeed connected={feed.connected} posts={feed.posts} signedIn={signedIn} canPublish={feed.connected ? feed.canPublish : founderDemo} name={name} avatarUrl={feed.connected ? feed.member?.avatar_url : null} demoMember={demoMember} readOnlyDemo={demoMember || !founderDemo} demoProfileStorageKey={founderDemo ? "dracarys_profile_founder_v1" : demoMember ? "dracarys_profile_member_v1" : undefined} />
  </section>;
}
