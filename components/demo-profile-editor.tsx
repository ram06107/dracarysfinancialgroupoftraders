"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { ProfileAvatar } from "@/components/profile-avatar";
import { PerformanceDashboard } from "@/components/performance-dashboard";
import { PersonalJournalPanel } from "@/components/personal-journal";
import { createDemoPerformanceEvents, demoTraderIds } from "@/lib/performance";

type DemoProfile = { public_name: string; bio: string; avatar_key: string; share_performance: boolean };
const STORAGE_KEYS = { founder: "dracarys_profile_founder_v1", member: "dracarys_profile_member_v1" } as const;

export function DemoProfileEditor({ role, initialName }: { role: "founder" | "member"; initialName: string }) {
  const canEdit = role === "founder";
  const storageKey = STORAGE_KEYS[role];
  const [profile, setProfile] = useState<DemoProfile>({ public_name: initialName, bio: "", avatar_key: "monogram", share_performance: false });
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          const candidate = parsed as Partial<DemoProfile>;
          const savedAvatar = typeof candidate.avatar_key === "string" && candidate.avatar_key.length <= 1_400_000 && (candidate.avatar_key === "dragon" || candidate.avatar_key.startsWith("data:image/")) ? candidate.avatar_key : "monogram";
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore this browser's local demo profile after hydration.
          setProfile({
            public_name: typeof candidate.public_name === "string" ? candidate.public_name.slice(0, 80) : initialName,
            bio: typeof candidate.bio === "string" ? candidate.bio.slice(0, 500) : "",
            avatar_key: savedAvatar,
            share_performance: candidate.share_performance === true,
          });
        }
      }
    } catch {
      setNotice("Saved profile details could not be read in this browser.");
    }
    setReady(true);
  }, [initialName, storageKey]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !profile.public_name.trim()) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ ...profile, public_name: profile.public_name.trim() }));
      setProfile((current) => ({ ...current, public_name: current.public_name.trim() }));
      setNotice("Profile saved in this browser.");
    } catch {
      setNotice("This browser could not save the profile. Check its local storage settings and try again.");
    }
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type)) || file.size > 1_000_000) {
      setNotice("Choose a PNG, JPG or WEBP image up to 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setProfile((current) => ({ ...current, avatar_key: reader.result as string }));
    };
    reader.onerror = () => setNotice("That image could not be read. Try another file.");
    reader.readAsDataURL(file);
  }

  const performanceEvents = createDemoPerformanceEvents().filter((event) => event.traderId === demoTraderIds[canEdit ? 0 : 1]);

  return (
    <section className="profile-page">
      <header className="profile-page-head"><div><p className="eyebrow eyebrow-dark">YOUR DRACARYS PROFILE</p><h1>A profile with<br /><em>room to think.</em></h1><p>Choose the name and short introduction shown beside your community notes.</p></div><span className="profile-page-index">{canEdit ? "FOUNDER TRADER / LOCAL" : "DEMO MEMBER / READ ONLY"}</span></header>
      {!ready && <p className="profile-status">Opening your local profile…</p>}
      {notice && <p className="profile-status" role="status">{notice}</p>}
      <PerformanceDashboard events={performanceEvents} accountKind={canEdit ? "trader" : "member"} title="Your trading record." subtitle="A fictional sample for observing how personal activity can be reviewed." />
      <PersonalJournalPanel entries={[]} demoRole={role} />
      <div className="profile-layout">
        <aside className="profile-preview-card" aria-live="polite">
          <span className="profile-card-kicker">{canEdit ? "LOCAL PROFILE PREVIEW" : "SAMPLE MEMBER PROFILE"}</span>
          <ProfileAvatar name={profile.public_name || initialName} avatarKey={profile.avatar_key} />
          <h2>{profile.public_name || initialName}</h2>
          <p>{profile.bio || "A little context helps people understand the person behind the market notes."}</p>
          <div className="profile-preview-meta"><span>ACCOUNT TYPE</span><strong>{canEdit ? "Founder Trader Demo" : "Read-only demo member"}</strong></div>
          <Link href="/community">Back to the community <span aria-hidden="true"></span></Link>
        </aside>
        <section className="profile-edit-card">
          <div className="profile-edit-heading"><div><span>PROFILE DETAILS</span><h2>{canEdit ? "Make it yours." : "A look at profile settings."}</h2></div><span>{canEdit ? "SAVED IN THIS BROWSER" : "READ ONLY"}</span></div>
          {canEdit ? <form className="profile-form" onSubmit={save}>
            <label htmlFor="demo-profile-name">Display name<small>Use the name members should see</small></label>
            <input id="demo-profile-name" value={profile.public_name} onChange={(event) => setProfile({ ...profile, public_name: event.target.value.slice(0, 80) })} minLength={2} maxLength={80} required />
            <label htmlFor="demo-profile-bio">A short introduction<small>Up to 500 characters</small></label>
            <textarea id="demo-profile-bio" value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value.slice(0, 500) })} maxLength={500} placeholder="What do you pay attention to in the markets?" />
            <label htmlFor="demo-profile-avatar">Profile mark<small>Choose initials or the DRACARYS emblem</small></label>
            <select id="demo-profile-avatar" value={profile.avatar_key === "dragon" ? "dragon" : "monogram"} onChange={(event) => setProfile({ ...profile, avatar_key: event.target.value === "dragon" ? "dragon" : "monogram" })}><option value="monogram">Name initials</option><option value="dragon">DRACARYS emblem</option></select>
            <label htmlFor="demo-profile-photo">Profile photo<small>PNG, JPG or WEBP · up to 1 MB</small></label>
            <input id="demo-profile-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void choosePhoto(event.target.files?.[0]); }} />
            <label htmlFor="demo-share-performance">Group analytics<small>Preview only · no data leaves this browser</small></label>
            <label className="profile-share-toggle"><input id="demo-share-performance" type="checkbox" checked={profile.share_performance} onChange={(event) => setProfile({ ...profile, share_performance: event.target.checked })} /><span>Allow anonymous totals in group analytics</span></label>
            <p className="profile-private-note">This is a local preview. Your details stay in this browser and are not visible to other members.</p>
            <button className="button button-dark" type="submit" disabled={!ready}>Save profile <span aria-hidden="true"></span></button>
          </form> : <div className="profile-readonly-copy"><p>Demo member profiles are read-only. Choose the Founder Trader Demo from the sign-in page to try editing a local profile.</p><Link className="button button-outline button-small" href="/sign-in">Change preview role <span aria-hidden="true"></span></Link></div>}
        </section>
      </div>
      <div className="profile-account-actions"><div><strong>Account access</strong><span>Leave this local demo account on this device.</span></div><form action={signOut}><button className="button button-outline button-small" type="submit">Sign out</button></form></div>
    </section>
  );
}
