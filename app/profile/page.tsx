import type { Metadata } from "next";
import { DemoProfileEditor } from "@/components/demo-profile-editor";
import { MemberProfileEditor, ProfileAccessPrompt, ProfileUnavailable, type MemberProfileData } from "@/components/member-profile";
import { getDemoRole } from "@/lib/demo-session";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getPersonalPerformanceEvents } from "@/lib/performance-live";
import { getPersonalJournal } from "@/lib/personal-journal";

export const metadata: Metadata = { title: "My profile" };

const statusMessages: Record<string, string> = {
  details: "! Check the name, introduction length and profile mark, then save again.",
  save: "! We could not save your profile. Please try again.",
  photo: "! Choose a PNG, JPG or WEBP image up to 2 MB, then try again.",
  unavailable: "! Profile editing is available after the member database is connected.",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const queryStatus = typeof query.saved === "string" ? "Your profile has been saved." : typeof query.error === "string" ? statusMessages[query.error] ?? "! Something went wrong while saving." : "";
  const journalStatus = typeof query.journal === "string" ? ({ saved: "Journal entry saved.", deleted: "Journal entry removed.", invalid: "Check the title and date, then add a note or attach an image.", image: "Choose a PNG, JPG, WEBP or GIF image up to 8 MB.", error: "The journal could not be saved. Check that its migrations have been applied.", setup: "The journal is available after Supabase is connected." } as Record<string, string>)[query.journal] ?? "" : "";

  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return <ProfileAccessPrompt />;

    const { data, error } = await supabase
      .from("public_member_profiles")
      .select("id, public_name, bio, avatar_key, share_performance, created_at, updated_at")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (error || !data) return <ProfileUnavailable message="The profile table is not ready. Apply the member profile migration, then reload this page." />;
    const [performance, journal, applicationResult, traderProfileResult] = await Promise.all([
      getPersonalPerformanceEvents(auth.user.id),
      getPersonalJournal(auth.user.id),
      supabase.from("trader_applications").select("status,public_name,public_message,interview_at,zoom_url,preferred_timezone").eq("member_id", auth.user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("trader_profiles").select("id").eq("member_id", auth.user.id).eq("is_published", true).maybeSingle(),
    ]);
    const profile = data as MemberProfileData;
    const traderApplication = applicationResult.error ? null : applicationResult.data;
    const avatarUrl = profile.avatar_key && !["monogram", "dragon"].includes(profile.avatar_key)
      ? supabase.storage.from("profile-avatars").getPublicUrl(profile.avatar_key).data.publicUrl
      : undefined;
    return <MemberProfileEditor profile={profile} status={queryStatus} avatarUrl={avatarUrl} performanceEvents={performance.events} accountKind={traderProfileResult.data ? "trader" : "member"} verifiedTrader={Boolean(traderProfileResult.data)} performanceError={performance.error} journalEntries={journal.entries} journalError={journal.error} journalStatus={journalStatus} traderApplication={traderApplication} />;
  }

  const role = await getDemoRole();
  if (!role) return <ProfileAccessPrompt />;
  return <DemoProfileEditor role={role} initialName={role === "founder" ? "Founder Trader" : "Demo member"} />;
}
