import Link from "next/link";
import { DemoChartImage } from "@/components/demo-chart-image";
import { demoCourses, demoJournal, demoMessages, demoPosts, demoProfiles, demoReports, demoSetups } from "@/lib/demo-data";

type Setup = (typeof demoSetups)[number];
type Profile = (typeof demoProfiles)[number];
type Post = (typeof demoPosts)[number];
type Report = (typeof demoReports)[number];
type Course = (typeof demoCourses)[number];
type Message = (typeof demoMessages)[number];
type JournalEntry = (typeof demoJournal)[number];

export function DemoTag({ children = "DEMO DATA" }: { children?: string }) {
  return <span className="demo-tag">{children}</span>;
}

export function PreviewUnavailable({ title }: { title: string }) {
  return (
    <section className="preview-unavailable">
      <p className="eyebrow eyebrow-dark">Live records</p>
      <h1>{title}</h1>
      <p>This section is not connected to the live data service yet. Demo examples are hidden while a database is configured.</p>
      <Link className="button button-dark button-small" href="/community">Visit the community</Link>
    </section>
  );
}

export function DemoSetupCard({ setup, compact = false }: { setup: Setup; compact?: boolean }) {
  return (
    <article className={`demo-setup-card${compact ? " demo-setup-compact" : ""}`} id={setup.id}>
      <div className="demo-setup-side"><DemoTag /><strong>{setup.instrument}</strong><span>{setup.direction} / {setup.trader}</span></div>
      <div className="demo-setup-main">
        <div className="demo-setup-heading"><h3>{setup.instrument} · {setup.direction}</h3><span className={`record-status status-${setup.result.toLowerCase()}`}>{setup.result}</span></div>
        <DemoChartImage variant={setup.chartVariant} caption="SAMPLE RECORD · NO LIVE PRICE DATA" />
        <p className="demo-copy">{setup.reasoning}</p>
        {!compact && <p className="demo-context">{setup.context}</p>}
        <div className="demo-levels">
          <div><span>ENTRY AREA</span><strong>{setup.entry}</strong></div>
          <div><span>STOP IDEA</span><strong>{setup.stop}</strong></div>
          <div><span>TARGET</span><strong>{setup.target}</strong></div>
        </div>
        <div className="demo-setup-foot"><span>{setup.published}</span><span>STATUS · {setup.status}</span><span>TRADER EXECUTION · {setup.execution}</span></div>
        {!compact && <div className="demo-review"><b>POST-TRADE REVIEW</b><p>{setup.review}</p></div>}
      </div>
    </article>
  );
}

export function DemoProfileCard({ profile }: { profile: Profile }) {
  return (
    <article className="demo-profile-card">
      <div className="demo-profile-head"><span className="profile-mark">{profile.field.slice(-2)}</span><DemoTag>PROFILE EXAMPLE</DemoTag></div>
      <h3>{profile.name}</h3>
      <p>{profile.style}</p>
      <div className="profile-market"><span>MARKETS</span><strong>{profile.markets}</strong></div>
      <div className="profile-note">{profile.note}</div>
    </article>
  );
}

export function DemoPostCard({ post }: { post: Post }) {
  return (
    <article className="demo-post-card">
      <div className="demo-post-head"><span className="avatar" aria-hidden="true">{post.author.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
        <div><strong>{post.author}</strong><small>{post.stamp}</small></div><DemoTag />
      </div>
      <p className="demo-post-body">{post.body}</p>
      <DemoChartImage variant={post.chartVariant} caption="FICTIONAL DESK NOTE · NOT LIVE MARKET DATA" />
      <div className="demo-replies">{post.replies.map((reply, index) => <div className="demo-reply" key={`${post.author}-${index}`}><strong>{reply.author}</strong><p>{reply.body}</p></div>)}</div>
      <div className="demo-post-foot">SAMPLE CONVERSATION <span>Read-only preview</span></div>
    </article>
  );
}

export function DemoReportCard({ report }: { report: Report }) {
  return (
    <article className="demo-report-card">
      <div className="demo-report-head"><DemoTag>DEMO REVIEW</DemoTag><span>{report.period}</span></div>
      <h3>{report.title}</h3><p>{report.body}</p>
      <div className="report-next"><span>NEXT WEEK</span><p>{report.next}</p></div>
      <div className="demo-post-foot">{report.author} <span>{report.focus}</span></div>
    </article>
  );
}

export function DemoCourseCard({ course }: { course: Course }) {
  return (
    <article className="demo-course-card"><div className="demo-course-top"><span>{course.number} / STUDY AREA</span><DemoTag>SAMPLE OUTLINE</DemoTag></div>
      <h3>{course.title}</h3><p>{course.copy}</p><div className="demo-course-foot">CURRICULUM PREVIEW <span>LESSON EXAMPLE BELOW</span></div>
    </article>
  );
}

export function DemoMessageCard({ message }: { message: Message }) {
  return (
    <article className="demo-message-card"><div className="demo-message-meta"><DemoTag /><span>{message.room}</span><time>{message.stamp}</time></div>
      <strong>{message.author}</strong><p>{message.body}</p><small>FICTIONAL PREVIEW CONVERSATION</small>
    </article>
  );
}

export function DemoJournalCard({ entry }: { entry: JournalEntry }) {
  return (
    <article className="demo-journal-card"><div className="demo-report-head"><DemoTag>SAMPLE NOTE</DemoTag><span>{entry.date}</span></div>
      <h3>{entry.instrument}</h3><p>{entry.body}</p><div className="demo-levels"><div><span>RISK NOTE</span><strong>{entry.risk}</strong></div><div><span>LESSON</span><strong>{entry.lesson}</strong></div></div>
    </article>
  );
}

export function DemoSetupList({ setups, compact = false }: { setups: Setup[]; compact?: boolean }) {
  return <div className="demo-setup-list">{setups.map((setup) => <DemoSetupCard key={setup.id} setup={setup} compact={compact} />)}</div>;
}

export function DemoProfileGrid() {
  return <div className="demo-profile-grid">{demoProfiles.map((profile) => <DemoProfileCard key={profile.field} profile={profile} />)}</div>;
}

export function DemoPostList() {
  return <div className="demo-post-list">{demoPosts.map((post) => <DemoPostCard key={post.author} post={post} />)}</div>;
}

export function DemoReportGrid() {
  return <div className="demo-report-grid">{demoReports.map((report) => <DemoReportCard key={report.author} report={report} />)}</div>;
}

export function DemoCourseGrid() {
  return <div className="demo-course-grid">{demoCourses.map((course) => <DemoCourseCard key={course.number} course={course} />)}</div>;
}

export function DemoMessageList() {
  return <div className="demo-message-list">{demoMessages.map((message, index) => <DemoMessageCard key={`${message.author}-${index}`} message={message} />)}</div>;
}

export function DemoJournalList() {
  return <div className="demo-journal-grid">{demoJournal.map((entry) => <DemoJournalCard key={entry.instrument} entry={entry} />)}</div>;
}
