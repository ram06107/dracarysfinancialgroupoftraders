import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { updatePublicProfile } from "@/app/actions/profile";
import { ProfileAvatar } from "@/components/profile-avatar";
import { PerformanceDashboard } from "@/components/performance-dashboard";
import type { PerformanceEvent } from "@/lib/performance";
import { PersonalJournalPanel } from "@/components/personal-journal";
import { VerifiedTraderBadge } from "@/components/verified-trader-badge";
import type { PersonalJournalEntry } from "@/lib/personal-journal";

export type MemberProfileData = {
  id: string;
  public_name: string;
  bio: string;
  avatar_key: string | null;
  share_performance?: boolean;
  created_at: string;
  updated_at?: string;
};

function memberSince(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Kampala" }).format(new Date(value));
}

export function ProfileAccessPrompt() {
  return <section className="profile-access-prompt"><p className="eyebrow eyebrow-dark">MEMBER PROFILE</p><h1>Your name.<br /><em>Your own page.</em></h1><p>Sign in to view and edit your public member profile. Demo members can read the preview; the Founder Trader demo can edit a profile saved in this browser.</p><div><Link className="button button-dark button-small" href="/sign-in">Log in <span aria-hidden="true"></span></Link><Link className="profile-access-link" href="/sign-up">Create an account</Link></div></section>;
}

export function ProfileUnavailable({ message }: { message: string }) {
  return <section className="profile-access-prompt"><p className="eyebrow eyebrow-dark">MEMBER PROFILE</p><h1>Profile settings<br /><em>are unavailable.</em></h1><p>{message}</p><Link className="button button-dark button-small" href="/community">Return to the community <span aria-hidden="true"></span></Link></section>;
}

export function MemberProfileEditor({ profile, status = "", avatarUrl, performanceEvents = [], accountKind = "member", performanceError = false, journalEntries = [], journalError = false, journalStatus = "", traderApplication = null, verifiedTrader = false }: { profile: MemberProfileData; status?: string; avatarUrl?: string; performanceEvents?: PerformanceEvent[]; accountKind?: "trader" | "member"; performanceError?: boolean; journalEntries?: PersonalJournalEntry[]; journalError?: boolean; journalStatus?: string; traderApplication?: { status: string; public_name: string; public_message: string | null; interview_at?: string | null; zoom_url?: string | null; preferred_timezone?: string | null } | null; verifiedTrader?: boolean }) {
  return (
    <section className="profile-page">
      <header className="profile-page-head"><div><p className="eyebrow eyebrow-dark">YOUR DRACARYS PROFILE</p><h1>A profile with<br /><em>room to think.</em></h1><p>Choose the name and short introduction people see beside your community posts.</p></div><span className="profile-page-index">MEMBER / PROFILE</span></header>
      {status && <p className={`profile-status ${status.startsWith("! ") ? "profile-status-error" : ""}`} role="status">{status}</p>}
      <section className="profile-trader-path"><div><span className="profile-card-kicker">ACCOUNT TYPE</span><h2>{verifiedTrader ? <>DRACARYS Financial Trader <VerifiedTraderBadge /></> : "Public Member account"}</h2><p>{verifiedTrader ? "Your identity, background, interview and assessment have been approved. The public verification mark identifies your DRACARYS trader profile." : traderApplication && traderApplication.status !== "declined" ? `Trader application pending review · ${traderApplication.status.replaceAll("_", " ")}. Your account stays a Public Member until approved.` : "Every account starts as a Public Member. Trader access follows a private application, verification, Zoom interview and assessment."}</p>{traderApplication?.public_message && <p className="profile-trader-message">{traderApplication.public_message}</p>}</div>{verifiedTrader ? <Link className="button button-outline button-small" href="/traders">View trader directory</Link> : traderApplication && traderApplication.status !== "declined" ? <Link className="button button-outline button-small" href="/profile/trader-application">View application</Link> : <Link className="button button-dark button-small" href="/profile/trader-application">{traderApplication?.status === "declined" ? "Apply again" : "Apply for trader account"}</Link>}</section>
      {performanceError && <p className="profile-status">Your latest private performance data could not be loaded. Check the performance migration and refresh.</p>}
      <PerformanceDashboard events={performanceEvents} accountKind={accountKind} title={accountKind === "trader" ? "Your trader record." : "Your trading record."} subtitle={accountKind === "trader" ? "Published setups and recorded executions from your public trader record." : "Only executions you recorded are shown here. They remain private to your account."} />
      <PersonalJournalPanel entries={journalEntries} error={journalError} status={journalStatus} />
      <div className="profile-layout">
        <aside className="profile-preview-card">
          <span className="profile-card-kicker">PUBLIC PROFILE</span>
          <ProfileAvatar name={profile.public_name} avatarKey={profile.avatar_key} avatarUrl={avatarUrl} />
          <h2 className="profile-public-name">{profile.public_name}{verifiedTrader && <VerifiedTraderBadge compact />}</h2>
          <p>{profile.bio || "A little context helps people understand the person behind the market notes."}</p>
          <div className="profile-preview-meta"><span>MEMBER SINCE</span><strong>{memberSince(profile.created_at)}</strong></div>
          <Link href="/community">Back to the community <span aria-hidden="true"></span></Link>
        </aside>
        <section className="profile-edit-card">
          <div className="profile-edit-heading"><div><span>PROFILE DETAILS</span><h2>Make it yours.</h2></div><span>VISIBLE TO MEMBERS</span></div>
          <form action={updatePublicProfile} className="profile-form">
            <label htmlFor="profile-public-name">Display name<small>Use the name members should see</small></label>
            <input id="profile-public-name" name="public_name" defaultValue={profile.public_name} minLength={2} maxLength={80} required />
            <label htmlFor="profile-bio">A short introduction<small>Up to 500 characters</small></label>
            <textarea id="profile-bio" name="bio" defaultValue={profile.bio} maxLength={500} placeholder="What do you pay attention to in the markets?" />
            <label htmlFor="profile-avatar">Profile mark<small>Choose initials or the DRACARYS emblem</small></label>
            <select id="profile-avatar" name="avatar_key" defaultValue={profile.avatar_key && !["monogram", "dragon"].includes(profile.avatar_key) ? "keep" : profile.avatar_key || "monogram"}><option value="monogram">Name initials</option><option value="dragon">DRACARYS emblem</option>{profile.avatar_key && !["monogram", "dragon"].includes(profile.avatar_key) && <option value="keep">Keep uploaded photo</option>}</select>
            <label htmlFor="profile-photo">Profile photo<small>PNG, JPG or WEBP · up to 2 MB</small></label>
            <input id="profile-photo" type="file" name="avatar_file" accept="image/png,image/jpeg,image/webp" />
            <label htmlFor="profile-share-performance">Group performance<small>Share anonymous counts only</small></label>
            <label className="profile-share-toggle"><input id="profile-share-performance" type="checkbox" name="share_performance" defaultChecked={profile.share_performance === true} /><span>Include my executions in group analytics</span></label>
            <p className="profile-private-note">Email and sign-in details stay private. Member executions are hidden; group analytics include only daily totals after at least five members opt in.</p>
            <button className="button button-dark" type="submit">Save profile <span aria-hidden="true"></span></button>
          </form>
        </section>
      </div>
      <div className="profile-account-actions"><div><strong>Account access</strong><span>Sign out of this DRACARYS account on this device.</span></div><form action={signOut}><button className="button button-outline button-small" type="submit">Sign out</button></form></div>
    </section>
  );
}

export function PublicMemberProfile({ profile, isOwner = false, avatarUrl, verifiedTrader = false }: { profile: MemberProfileData; isOwner?: boolean; avatarUrl?: string; verifiedTrader?: boolean }) {
  return (
    <section className="public-profile-page">
      <p className="eyebrow eyebrow-dark">DRACARYS / COMMUNITY MEMBER</p>
      <article className="public-profile-card">
        <div className="public-profile-top"><ProfileAvatar name={profile.public_name} avatarKey={profile.avatar_key} avatarUrl={avatarUrl} /><span>MEMBER SINCE · {memberSince(profile.created_at)}</span></div>
        <h1 className="profile-public-name">{profile.public_name}{verifiedTrader && <VerifiedTraderBadge />}</h1>
        <p className="public-profile-bio">{profile.bio || "This member has not added an introduction yet."}</p>
        <div className="public-profile-rule" />
        <div className="public-profile-foot"><Link href="/community">Visit the community <span aria-hidden="true"></span></Link>{isOwner && <Link href="/profile">Edit your profile</Link>}</div>
      </article>
    </section>
  );
}
