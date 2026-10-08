import Link from "next/link";

export function ComingSoon({ title, eyebrow, description }: { title: string; eyebrow: string; description: string }) {
  return <section className="coming-soon-page">
    <p className="eyebrow eyebrow-dark">{eyebrow}</p>
    <div className="coming-soon-layout">
      <div>
        <span className="coming-soon-stamp"><i /> IN DEVELOPMENT</span>
        <h1>{title}<br /><em>Coming soon.</em></h1>
        <p className="coming-soon-description">{description}</p>
        <div className="coming-soon-links">
          <Link className="button button-dark button-small" href="/feed">Visit the feed <span aria-hidden="true"></span></Link>
          <Link className="coming-soon-text-link" href="/community">Open the community <span aria-hidden="true"></span></Link>
        </div>
      </div>
      <aside className="coming-soon-note"><span>DRACARYS / ROADMAP</span><strong>We’re building this in the open.</strong><p>This area is being prepared for a proper release. The pages marked here are not active yet.</p><Link href="/analytics">See available performance data <span aria-hidden="true"></span></Link></aside>
    </div>
  </section>;
}
