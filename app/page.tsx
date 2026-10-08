import Link from "next/link";
import Image from "next/image";
import { BrandMark } from "@/components/brand-mark";
import { DemoProfileGrid, DemoSetupList } from "@/components/demo-sections";
import { demoSetups } from "@/lib/demo-data";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default function HomePage() {
  const demoMode = !hasSupabaseConfig();
  return (
    <>
      <section className="home-hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow"><span className="eyebrow-dot" /> {demoMode ? "Local preview / sample content" : "A trading community built in the open"}</p>
          <h1>The work is<br /><em>the record.</em></h1>
          <p className="hero-intro">{demoMode ? "Explore the platform with fictional profiles, setups and conversations. No live trader activity is connected." : "Professional traders. Different methods. One shared commitment to show the analysis, the decisions and what followed."}</p>
          <div className="hero-actions">
            <Link className="button button-light" href="/community">Enter the community <span aria-hidden="true"></span></Link>
            <a className="text-link text-link-light" href="#record">How we keep the record <span aria-hidden="true"></span></a>
          </div>
          <div className="hero-footnote"><span>01 / 03</span><span className="hero-rule" /><span>{demoMode ? "FICTIONAL EXAMPLES · NOT LIVE ACTIVITY" : "REAL TRADERS. REAL ANALYSIS. REAL RESULTS."}</span></div>
        </div>
        <div className="hero-scroll" aria-hidden="true">
          <Image src="/dracarys-banner.png" alt="" width={1326} height={1920} className="hero-scroll-art" priority />
          <Image src="/dracarys-financial-group.png" alt="" width={1536} height={1024} className="hero-scroll-logo" />
        </div>
        <div className="hero-side-note">PROCESS BEFORE PROMISE</div>
      </section>

      <section className="intro-strip">
        <p>We don&apos;t ask you to take our word for it.</p>
        <p>We document the work.</p>
      </section>

      <section className="principles section-wrap" id="record">
        <div className="section-heading">
          <p className="eyebrow eyebrow-dark">A public practice</p>
          <h2>Trading, with the<br /><em>context left in.</em></h2>
        </div>
        <div className="principle-list">
          <article className="principle-row"><span className="principle-index">01</span><div><h3>Show the thinking</h3><p>Analysis belongs beside the decision it informed. A chart without context tells half the story.</p></div></article>
          <article className="principle-row"><span className="principle-index">02</span><div><h3>Keep the whole record</h3><p>Setups stay visible through the outcome. Corrections keep their history, and skipped trades stay distinct from trades taken.</p></div></article>
          <article className="principle-row"><span className="principle-index">03</span><div><h3>Learn from the result</h3><p>Good decisions can lose. Poor decisions can win. Review the process without dressing up the outcome.</p></div></article>
        </div>
      </section>

      {demoMode && <section className="demo-home-content">
        <div className="section-wrap">
          <div className="demo-notice"><strong>DEMO DATA</strong><span>All profiles, records and conversations on this page are fictional examples. They are not founder activity or performance claims.</span></div>
          <div className="demo-section-heading"><p className="eyebrow eyebrow-dark">THE TRADERS / PROFILE EXAMPLES</p><h2>Different approaches. No forced uniformity.</h2><p>Sample personas make the directory easier to explore before real trader profiles are added.</p><Link className="text-link text-link-dark" href="/traders">Meet the sample profiles <span aria-hidden="true"></span></Link></div>
          <DemoProfileGrid />
          <div className="demo-section-heading demo-section-spaced"><p className="eyebrow eyebrow-dark">THE DRAGON’S RECORD / SETUP EXAMPLES</p><h2>Read the idea and the outcome together.</h2><p>The sample record includes a win, a loss and an unresolved setup. Trader execution is shown separately.</p><Link className="text-link text-link-dark" href="/record">Open all three sample records <span aria-hidden="true"></span></Link></div>
          <DemoSetupList setups={demoSetups.slice(0, 2)} compact />
          <div className="demo-journey-links"><Link href="/analytics"><span>01 / RECORD</span><strong>Analytics</strong><small>Counts derived from the examples</small></Link><Link href="/chronicle"><span>02 / HISTORY</span><strong>The Chronicle</strong><small>Coming soon</small></Link><Link href="/forge"><span>03 / LEARNING</span><strong>The Forge</strong><small>Coming soon</small></Link><Link href="/war-room"><span>04 / MENTORSHIP</span><strong>The War Room</strong><small>Coming soon</small></Link></div>
        </div>
      </section>}

      <section className="community-band">
        <div className="community-band-copy">
          <p className="eyebrow">The open room</p>
          <h2>A place to talk<br />markets <em>like people.</em></h2>
          <p>{demoMode ? "Read sample conversations, explore the public record and see how member discussions will fit around it." : "Compare notes, ask better questions and hear from our traders. Free membership gives you a seat in the community."}</p>
          <Link className="button button-light" href="/community">Visit the community <span aria-hidden="true"></span></Link>
        </div>
        <div className="band-note" aria-hidden="true"><span className="band-rule" /><span>THE RECORD<br />STARTS WITH A<br />CONVERSATION.</span></div>
      </section>

      <section className="closing-note section-wrap">
        <div className="closing-mark"><BrandMark /></div>
        <div><p className="eyebrow eyebrow-dark">DRACARYS Financial Group of Traders</p><p className="closing-line">No perfect track records.<br /><em>No missing chapters.</em></p></div>
        <Link className="text-link text-link-dark" href="/about">Read our approach <span aria-hidden="true"></span></Link>
      </section>
    </>
  );
}
