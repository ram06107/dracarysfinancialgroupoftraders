import type { Metadata } from "next";
import Link from "next/link";
import { sendTraderApplicationResponse, submitTraderApplication } from "@/app/actions/trader-application";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Trader account application" };

type Application = {
  id: string;
  status: string;
  public_name: string;
  public_message: string | null;
  submitted_at: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  preferred_timezone: string;
  interview_availability: string;
  interview_at: string | null;
  zoom_url: string | null;
};

const statusLabels: Record<string, string> = {
  submitted: "Submitted",
  reviewing: "Initial review",
  verification: "Verification",
  assessment: "Assessment",
  interview_scheduled: "Zoom interview arranged",
  interview_completed: "Interview completed",
  needs_information: "Waiting for your response",
  approved: "Approved",
  declined: "Rejected",
};

const errorMessages: Record<string, string> = {
  setup: "Trader applications are not connected yet. Apply all trader account, interview and verification migrations in Supabase, then reload this page.",
  details: "Check the required fields and try again. The assessment response needs at least 120 characters.",
  already: "Your account already has trader access.",
  duplicate: "You already have an application in progress.",
  response: "We could not send your response. It may already be back under review.",
  save: "We could not submit your application. Please try again.",
  contact: "Add a contact name and phone number, and check your time zone and preferred interview times.",
};

function appointmentLabel(value: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Kampala" }).format(new Date(value));
  }
}

export default async function TraderApplicationPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? errorMessages[query.error] : undefined;
  const submitted = typeof query.submitted === "string";
  const responded = typeof query.responded === "string";

  if (!hasSupabaseConfig()) {
    return <section className="demo-page trader-application-page"><p className="eyebrow eyebrow-dark">ACCOUNT PATHWAYS</p><h1>Trader access<br /><em>is earned through review.</em></h1><p>Connect Supabase and apply the trader application migration to open the application and review process.</p><Link className="button button-dark" href="/profile">Back to your profile</Link></section>;
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return <section className="demo-page trader-application-page"><p className="eyebrow eyebrow-dark">ACCOUNT PATHWAYS</p><h1>Trader access<br /><em>starts with a member account.</em></h1><p>Sign in as a DRACARYS member before you apply for trader review.</p><Link className="button button-dark" href="/sign-in?notice=join">Log in</Link></section>;
  }

  const [{ data: profile }, { data: applications, error: applicationError }, { data: foundingTrader }] = await Promise.all([
    supabase.from("public_member_profiles").select("public_name").eq("id", auth.user.id).maybeSingle(),
    supabase.from("trader_applications").select("id,status,public_name,public_message,submitted_at,contact_name,contact_email,contact_phone,preferred_timezone,interview_availability,interview_at,zoom_url").eq("member_id", auth.user.id).order("submitted_at", { ascending: false }).limit(1),
    supabase.rpc("request_has_staff_role", { required_role: "founding_trader" }),
  ]);
  const latest = (applications?.[0] ?? null) as Application | null;
  const hasActiveApplication = latest && latest.status !== "declined";
  const { data: responseRows } = latest
    ? await supabase.from("trader_application_responses").select("id,response,created_at").eq("application_id", latest.id).order("created_at", { ascending: true })
    : { data: [] };
  const responses = (responseRows ?? []) as Array<{ id: string; response: string; created_at: string }>;

  return <section className="demo-page trader-application-page">
    <header className="trader-application-heading"><div><p className="eyebrow eyebrow-dark">ACCOUNT PATHWAYS / PRIVATE APPLICATION</p><h1>Trader access<br /><em>is earned through review.</em></h1><p>A DRACARYS Financial Trader account is an additional professional role on your member account. Applying does not change your account or grant feed or setup publishing privileges.</p></div><Link className="trader-application-back" href="/profile">Back to profile</Link></header>

    <div className="trader-application-principles"><article><span>01 / VERIFY</span><h2>Identity and background</h2><p>The Administration Department contacts you privately to verify identity and professional history. Do not upload identity documents here.</p></article><article><span>02 / INTERVIEW</span><h2>Meet on Zoom</h2><p>The department arranges an interview and sends the date and Zoom link to your private application page.</p></article><article><span>03 / APPROVE</span><h2>Publish with accountability</h2><p>Your account stays pending review until the department approves it. Approved traders receive a public DRACARYS verification cap.</p></article></div>

    {error && <p className="trader-application-alert" role="alert">{error}</p>}
    {submitted && <p className="trader-application-success" role="status">Your application has been received by the DRACARYS Administration Department. Your account remains a public member while it is under review.</p>}
    {responded && <p className="trader-application-success" role="status">Your response has been sent to the review team.</p>}

    {foundingTrader === true ? <section className="trader-application-status"><p className="eyebrow eyebrow-dark">DRACARYS FOUNDING TRADER ACCOUNT</p><h2>Your founder account is verified.</h2><p>As the founder, your account has founding trader status by default. Your public trader profile carries the DRACARYS verification mark and can publish feed posts and setups. Other applicants continue through the standard verification and interview process.</p><Link href="/traders">View the public trader directory</Link></section> : applicationError ? <section className="trader-application-migration"><strong>Application service needs setup.</strong><p>Apply the trader account, review, interview status and verified trader workflow migrations in Supabase, then reload this page.</p></section> : latest?.status === "approved" ? <section className="trader-application-status"><p className="eyebrow eyebrow-dark">DRACARYS FINANCIAL TRADER ACCOUNT</p><h2>Your trader profile is approved.</h2><p>You passed the DRACARYS verification and interview process. Your public profile now carries the verified trader mark.</p><Link href="/traders">View the public trader directory</Link></section> : hasActiveApplication ? <section className="trader-application-status">
      <div className="trader-application-status-heading"><div><p className="eyebrow eyebrow-dark">YOUR APPLICATION · PRIVATE</p><h2>Pending review</h2><p>Application for <strong>{latest.public_name}</strong> · submitted {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(latest.submitted_at))}</p></div><span className="trader-status-pill trader-status-pending">PENDING REVIEW</span></div>
      <div className="trader-review-stage"><span>CURRENT STAGE</span><strong>{statusLabels[latest.status] ?? "In review"}</strong><p>Your account remains a Public Member until the Administration Department approves your application.</p></div>
      {latest.interview_at && latest.zoom_url && <section className="trader-zoom-appointment"><p className="eyebrow eyebrow-dark">ADMINISTRATION DEPARTMENT / ZOOM INTERVIEW</p><h3>{appointmentLabel(latest.interview_at, latest.preferred_timezone || "Africa/Kampala")}</h3><p>Shown in {latest.preferred_timezone || "Africa/Kampala"}. Join from a quiet place and have your work history and process assessment ready.</p><a className="button button-dark button-small" href={latest.zoom_url} target="_blank" rel="noreferrer">Join Zoom interview</a></section>}
      {latest.public_message && <div className="trader-review-message"><strong>Message from DRACARYS Administration</strong><p>{latest.public_message}</p></div>}
      {responses.length > 0 && <div className="trader-application-responses"><strong>Your follow-up</strong>{responses.map((item) => <p key={item.id}>{item.response}<time>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(item.created_at))}</time></p>)}</div>}
      {latest.status === "needs_information" && <form action={sendTraderApplicationResponse} className="trader-response-form"><input type="hidden" name="application_id" value={latest.id} /><label htmlFor="trader-application-response">Reply to the review team <small>20–1,800 characters. Do not include identity documents or sensitive financial information.</small></label><textarea id="trader-application-response" name="response" minLength={20} maxLength={1800} required placeholder="Add the clarification requested by the review team." /><button className="button button-dark button-small" type="submit">Send response</button></form>}
      <p className="trader-application-private-note">The department will contact you using the email and phone number on your application. Contact details and the review are visible only to you and administrators.</p>
    </section> : <section className="trader-application-form-card">
      <div><p className="eyebrow eyebrow-dark">APPLICATION / 01</p><h2>Tell us how you work.</h2><p>The application and contact details are private to the Administration Department. The account email on your sign-in will be used to reach you. Please do not upload identity documents, account statements, client details or other sensitive financial information.</p><div className="trader-standards-summary"><strong>Trader standards</strong><ul><li>Publish reasoning and the date it was known.</li><li>State invalidation and risk limits clearly.</li><li>Update, correct and close records transparently.</li><li>Disclose uncertainty; never promise returns.</li><li>Respect member privacy and the community code of conduct.</li></ul></div></div>
      <form action={submitTraderApplication} className="trader-application-form">
        <label htmlFor="trader-contact-name">Name for the interview</label><input id="trader-contact-name" name="contact_name" minLength={2} maxLength={120} required />
        <label htmlFor="trader-contact-email">Account email <small>Used by the Administration Department</small></label><input id="trader-contact-email" type="email" value={auth.user.email ?? ""} readOnly />
        <label htmlFor="trader-contact-phone">Phone / WhatsApp</label><input id="trader-contact-phone" name="contact_phone" type="tel" autoComplete="tel" minLength={7} maxLength={32} pattern="[+()0-9 .-]{7,32}" required placeholder="Include your country code" />
        <label htmlFor="trader-timezone">Your time zone</label><input id="trader-timezone" name="preferred_timezone" defaultValue="Africa/Kampala" maxLength={64} required placeholder="Africa/Kampala" />
        <label htmlFor="trader-interview-availability">Interview availability <small>Days and times that usually work</small></label><textarea id="trader-interview-availability" name="interview_availability" maxLength={500} placeholder="For example, weekdays after 15:00 EAT" />
        <label htmlFor="trader-public-name">Public trader name</label><input id="trader-public-name" name="public_name" defaultValue={profile?.public_name ?? ""} minLength={2} maxLength={80} required />
        <label htmlFor="trader-markets">Markets you cover <small>Separate up to 12 markets with commas</small></label><input id="trader-markets" name="markets" placeholder="EURUSD, XAUUSD" required />
        <label htmlFor="trader-years">Years of market experience</label><input id="trader-years" name="years_experience" type="number" min="0" max="60" step="1" defaultValue="0" required />
        <label htmlFor="trader-experience">Professional background <small>40–1,600 characters</small></label><textarea id="trader-experience" name="experience_summary" minLength={40} maxLength={1600} required placeholder="Describe your relevant experience, responsibilities and how it can be verified." />
        <label htmlFor="trader-approach">Trading approach <small>80–2,400 characters</small></label><textarea id="trader-approach" name="trading_approach" minLength={80} maxLength={2400} required placeholder="Explain the markets and conditions you focus on, how you frame an idea and what would invalidate it." />
        <label htmlFor="trader-assessment">Process assessment <small>Use a historical example. Do not submit a live signal.</small></label><textarea id="trader-assessment" name="assessment_response" minLength={120} maxLength={3200} required placeholder="Walk through one past market idea: what you knew at the time, your thesis, alternatives, invalidation, risk controls, and what the record showed afterward." />
        <label className="trader-code-accept"><input type="checkbox" name="code_accepted" required /><span>I will publish reasoned analysis, disclose uncertainty, keep the record accurate, and follow the DRACARYS trader standards.</span></label>
        <button className="button button-dark" type="submit">Submit for review</button>
      </form>
    </section>}
    {latest?.status === "declined" && <p className="trader-application-reapply">Your previous application was not approved. You may submit a new application after reviewing your approach.</p>}
  </section>;
}
