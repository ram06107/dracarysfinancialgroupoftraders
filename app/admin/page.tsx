import type { Metadata } from "next";
import Link from "next/link";
import { decideTraderApplication, reviewTraderApplication, scheduleTraderInterview } from "@/app/actions/trader-application";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Administration" };

type Application = {
  id: string; member_id: string; public_name: string; markets: string[];
  years_experience: number; experience_summary: string; trading_approach: string;
  assessment_response: string; code_accepted: boolean; status: string;
  public_message: string | null; submitted_at: string;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  preferred_timezone: string; interview_availability: string; interview_at: string | null;
  zoom_url: string | null; interview_completed_at: string | null;
};
type Review = {
  application_id: string; identity_verified: boolean; background_verified: boolean;
  assessment_passed: boolean; assessment_score: number | null; private_notes: string;
};
type ApplicantResponse = { id: string; application_id: string; response: string; created_at: string };
type ApplicationQueryError = { code?: string };
const statusLabel: Record<string, string> = {
  submitted: "Submitted", reviewing: "Initial review", verification: "Verification",
  assessment: "Assessment", interview_scheduled: "Interview scheduled",
  interview_completed: "Interview completed", needs_information: "Waiting on applicant",
  approved: "Approved", declined: "Rejected",
};

function eastAfricaLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function appointmentLabel(value: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Kampala" }).format(new Date(value));
  }
}

function applicationLoadMessage(error: ApplicationQueryError) {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return "The trader application table is missing from this Supabase project. Apply the trader account migrations in order, then reload this page.";
  }
  if (error.code === "42703" || error.code === "PGRST204") {
    return "The trader application table is missing required workflow fields. Apply all trader interview and verification migrations, then reload.";
  }
  if (error.code === "42501") {
    return "Supabase denied access to the application queue. Apply the latest trader application access migration, then sign out and back in.";
  }
  return "The application queue could not be loaded from Supabase. Check that this app and the migrations use the same Supabase project, then refresh.";
}

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const hasNotice = typeof query.reviewed === "string" || typeof query.decided === "string";
  const decisionSaved = typeof query.decided === "string";
  const interviewScheduled = typeof query.interview === "string";
  const reviewFailed = query.error === "review";
  if (!hasSupabaseConfig()) return <section className="admin-page"><p className="eyebrow eyebrow-dark">DRACARYS / ADMINISTRATION</p><h1>Review trader<br /><em>applications with care.</em></h1><p>Connect Supabase and apply the trader application migration before opening the administration panel.</p></section>;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return <section className="admin-page"><p className="eyebrow eyebrow-dark">DRACARYS / ADMINISTRATION</p><h1>Administrator sign in<br /><em>required.</em></h1><p>Sign in with an account assigned the administrator role to review applications.</p><Link className="button button-dark" href="/sign-in">Log in</Link></section>;

  const { data: isAdmin, error: permissionError } = await supabase.rpc("request_is_admin");
  if (permissionError || isAdmin !== true) return <section className="admin-page"><p className="eyebrow eyebrow-dark">DRACARYS / ADMINISTRATION</p><h1>This area is<br /><em>restricted.</em></h1><p>{permissionError ? "The administrator access check is unavailable. Apply the trader application migration, then reload." : "This account is not assigned administrator permissions. Trader approvals are handled by designated administrators."}</p><Link href="/profile">Return to your profile</Link></section>;

  const { data: rows, error } = await supabase.from("trader_applications").select("id,member_id,public_name,markets,years_experience,experience_summary,trading_approach,assessment_response,code_accepted,status,public_message,submitted_at,contact_name,contact_email,contact_phone,preferred_timezone,interview_availability,interview_at,zoom_url,interview_completed_at").order("submitted_at", { ascending: false });
  const applications = (rows ?? []) as Application[];
  const ids = applications.map((application) => application.id);
  const memberIds = [...new Set(applications.map((application) => application.member_id))];
  const [reviewsResult, profilesResult, responsesResult] = await Promise.all([
    ids.length ? supabase.from("trader_application_reviews").select("application_id,identity_verified,background_verified,assessment_passed,assessment_score,private_notes").in("application_id", ids).order("reviewed_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    memberIds.length ? supabase.from("public_member_profiles").select("id,public_name").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from("trader_application_responses").select("id,application_id,response,created_at").in("application_id", ids).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  const reviewByApplication = new Map<string, Review>();
  for (const review of (reviewsResult.data ?? []) as Review[]) if (!reviewByApplication.has(review.application_id)) reviewByApplication.set(review.application_id, review);
  const nameByMember = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.public_name]));
  const responsesByApplication = new Map<string, ApplicantResponse[]>();
  for (const response of (responsesResult.data ?? []) as ApplicantResponse[]) responsesByApplication.set(response.application_id, [...(responsesByApplication.get(response.application_id) ?? []), response]);
  const openCount = applications.filter((application) => !["approved", "declined"].includes(application.status)).length;
  const approvedCount = applications.filter((application) => application.status === "approved").length;

  return <section className="admin-page">
    <header className="admin-page-head"><div><p className="eyebrow eyebrow-dark">DRACARYS / PRIVATE ADMINISTRATION</p><h1>Trader approval<br /><em>desk.</em></h1><p>Review each application against the same process. An approval gives the member a public trader profile and a visible trading record.</p></div><Link href="/profile">Your profile</Link></header>
    <div className="admin-summary"><article><span>OPEN APPLICATIONS</span><strong>{openCount}</strong></article><article><span>APPROVED APPLICATIONS</span><strong>{approvedCount}</strong></article><article><span>APPROVAL STANDARD</span><strong>70 / 100</strong></article></div>
    {hasNotice && <p className="trader-application-success" role="status">{decisionSaved ? "Decision saved. The applicant’s account access has been updated." : "Review saved."}</p>}
    {interviewScheduled && <p className="trader-application-success" role="status">Zoom appointment saved. The applicant can see it in their private application page.</p>}
    {reviewFailed && <p className="trader-application-alert" role="alert">The decision could not be saved. Confirm the application is still open, then try again.</p>}
    {query.error === "details" && <p className="trader-application-alert" role="alert">Check the score and review text lengths, then save again.</p>}
    {query.error === "forbidden" && <p className="trader-application-alert" role="alert">Your administrator permission could not be confirmed. Sign out, sign back in and retry.</p>}
    {query.error === "decision" && <p className="trader-application-alert" role="alert">The final decision could not be saved. Refresh the page and try again.</p>}
    {query.error === "approval" && <p className="trader-application-alert" role="alert">Approval was not completed. Confirm the Zoom interview is marked complete, all three verification checks are selected, and the assessment score is at least 70.</p>}
    {query.error === "interview" && <p className="trader-application-alert" role="alert">The interview could not be scheduled. Enter a future East Africa Time appointment and a valid Zoom meeting link.</p>}
    {error ? <section className="admin-review-card"><h2>Application queue unavailable</h2><p>{applicationLoadMessage(error)}</p><Link href="/admin">Refresh queue</Link></section> : applications.length === 0 ? <section className="admin-review-card admin-empty"><h2>No applications found.</h2><p>Submitted trader applications will appear here. If an applicant saw a success message, confirm they submitted on this production site and refresh the queue.</p><Link href="/admin">Refresh queue</Link></section> : <div className="admin-application-list">{applications.map((application) => {
      const review = reviewByApplication.get(application.id);
      const closed = ["approved", "declined"].includes(application.status);
      return <article className="admin-review-card" key={application.id}>
        <div className="admin-review-heading"><div><p className="eyebrow eyebrow-dark">APPLICATION · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(application.submitted_at))}</p><h2>{application.public_name}</h2><p>Member: {nameByMember.get(application.member_id) ?? "DRACARYS member"} · {application.years_experience} years’ experience</p></div><span className={"trader-status-pill trader-status-" + application.status}>{statusLabel[application.status] ?? application.status}</span></div>
        <div className="admin-review-meta"><span>Markets: {application.markets.join(", ") || "Not provided"}</span><span>Standards accepted: {application.code_accepted ? "Yes" : "No"}</span><span>Member ID: {application.member_id}</span></div>
        <section className="admin-contact-card"><div><span>PRIVATE APPLICANT CONTACT</span><strong>{application.contact_name || "Contact name not supplied"}</strong></div><div><span>EMAIL</span>{application.contact_email ? <a href={`mailto:${application.contact_email}`}>{application.contact_email}</a> : <strong>Not supplied</strong>}</div><div><span>PHONE</span>{application.contact_phone ? <a href={`tel:${application.contact_phone}`}>{application.contact_phone}</a> : <strong>Not supplied</strong>}</div><div><span>TIME ZONE</span><strong>{application.preferred_timezone || "Africa/Kampala"}</strong></div><div className="admin-contact-availability"><span>INTERVIEW AVAILABILITY</span><strong>{application.interview_availability || "No preferred times supplied"}</strong></div></section>
        <section className="admin-application-answer"><h3>Professional background</h3><p>{application.experience_summary}</p></section>
        <section className="admin-application-answer"><h3>Trading approach</h3><p>{application.trading_approach}</p></section>
        <section className="admin-application-answer"><h3>Process assessment</h3><p>{application.assessment_response}</p></section>
        {(responsesByApplication.get(application.id) ?? []).map((response) => <section className="admin-applicant-response" key={response.id}><h3>Applicant follow-up · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(new Date(response.created_at))}</h3><p>{response.response}</p></section>)}
        {application.public_message && <div className="admin-member-message"><strong>Last message to applicant</strong><p>{application.public_message}</p></div>}
        {application.interview_at && application.zoom_url && <section className="admin-interview-current"><strong>Zoom interview · {appointmentLabel(application.interview_at, application.preferred_timezone || "Africa/Kampala")}</strong><a href={application.zoom_url} target="_blank" rel="noreferrer">Open Zoom meeting</a>{application.interview_completed_at && <span>Interview marked complete</span>}</section>}
        {!closed && <form action={reviewTraderApplication} className="admin-review-form">
          <input type="hidden" name="application_id" value={application.id} />
          <label>Review stage<select name="status" defaultValue={application.status === "submitted" ? "reviewing" : application.status}><option value="reviewing">Initial review</option><option value="verification">Private verification</option><option value="assessment">Assessment</option>{application.status === "interview_scheduled" && <option value="interview_scheduled">Interview scheduled</option>}{application.status === "interview_scheduled" || application.status === "interview_completed" ? <option value="interview_completed">Interview completed</option> : null}<option value="needs_information">Waiting on applicant / request more information</option></select></label>
          <div className="admin-review-checks"><label><input type="checkbox" name="identity_verified" defaultChecked={review?.identity_verified} />Identity verified privately</label><label><input type="checkbox" name="background_verified" defaultChecked={review?.background_verified} />Background checked</label><label><input type="checkbox" name="assessment_passed" defaultChecked={review?.assessment_passed} />Assessment passed</label><label>Assessment score<input type="number" name="assessment_score" min="0" max="100" defaultValue={review?.assessment_score ?? ""} /></label></div>
          <label>Update visible to applicant<textarea name="public_message" maxLength={1200} defaultValue={application.public_message ?? ""} placeholder="Share the next step or explain the decision. Keep private verification details out of this message." /></label>
          <label>Private reviewer notes<textarea name="private_notes" maxLength={4000} defaultValue={review?.private_notes ?? ""} placeholder="Administrator-only. Record the basis for this stage and any follow-up required." /></label>
          <p className="admin-review-rule">Administrators may approve or reject an application directly at any stage. Approval grants feed and setup publishing access; rejection keeps the account at Public Member level. Record the basis for a direct decision in private notes.</p>
          <button className="button button-dark" type="submit">Save review</button>
          <div className="admin-decision-actions"><span>FINAL DECISION</span><button className="button button-outline admin-reject-button" type="submit" name="decision" value="declined" formAction={decideTraderApplication}>Reject application</button><button className="button button-dark" type="submit" name="decision" value="approved" formAction={decideTraderApplication}>Approve trader</button></div>
        </form>}
        {!closed && <form action={scheduleTraderInterview} className="admin-interview-form"><input type="hidden" name="application_id" value={application.id} /><div><p className="eyebrow eyebrow-dark">ADMINISTRATION DEPARTMENT / ZOOM</p><h3>Arrange the interview.</h3><p>Choose an appointment in East Africa Time (UTC+3). Paste the meeting link created in the department’s Zoom account. The applicant will see these details in their private application.</p></div><label>Appointment · EAT<input type="datetime-local" name="interview_at" min={eastAfricaLocalValue(new Date().toISOString())} defaultValue={eastAfricaLocalValue(application.interview_at)} required /></label><label>Zoom meeting link<input type="url" name="zoom_url" defaultValue={application.zoom_url ?? ""} placeholder="https://zoom.us/j/..." maxLength={500} required /></label><label>Message to applicant<textarea name="public_message" maxLength={1200} defaultValue={application.public_message ?? ""} placeholder="Confirm the interview date, time, and any preparation needed." /></label><button className="button button-dark button-small" type="submit">{application.interview_at ? "Reschedule interview" : "Schedule Zoom interview"}</button></form>}
      </article>;
    })}</div>}
  </section>;
}
