import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Our approach" };

export default function AboutPage() {
  return (
    <article className="about-page">
      <p className="eyebrow eyebrow-dark">Our approach</p>
      <h1>Don&apos;t follow a claim.<br /><em>Follow the record.</em></h1>
      <p className="about-lead">DRACARYS is a growing group of professional traders building a community around the work behind a trade: what was seen, what was done, what happened next and what could be learned from it.</p>
      <div className="about-columns">
        <section><span>01 / OPENNESS</span><h2>Leave the context in.</h2><p>A setup makes more sense alongside its reasoning, timing and follow-up. Where the record grows, the original remains readable.</p></section>
        <section><span>02 / ACCOUNTABILITY</span><h2>Keep outcomes distinct.</h2><p>A published idea is not the same as a trader&apos;s own execution, and neither tells us what a member did with it. We keep those records separate.</p></section>
        <section><span>03 / DEVELOPMENT</span><h2>Teach the process.</h2><p>Education should help members think for themselves. The academy and mentorship are being built around practice and review, not promises.</p></section>
      </div>
      <div className="about-join"><p>Start with the open community.</p><Link className="button button-dark" href="/community">Visit the Community <span aria-hidden="true"></span></Link></div>
      <p className="about-disclosure">Trading involves substantial risk and may not be suitable for everyone. Past performance is not a reliable indicator of future results. Nothing on this site guarantees profitability or is a substitute for independent financial advice. Members make their own trading decisions.</p>
    </article>
  );
}
