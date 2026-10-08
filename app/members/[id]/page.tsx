import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewUnavailable } from "@/components/demo-sections";
import { PublicMemberProfile, type MemberProfileData } from "@/components/member-profile";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Member profile" };

export default async function PublicMemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return <PreviewUnavailable title="Member profiles" />;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: profile, error }, { data: auth }, { data: traderProfile }] = await Promise.all([
    supabase.from("public_member_profiles").select("id, public_name, bio, avatar_key, created_at, updated_at").eq("id", id).maybeSingle(),
    supabase.auth.getUser(),
    supabase.from("trader_profiles").select("id").eq("member_id", id).eq("is_published", true).maybeSingle(),
  ]);
  if (error || !profile) notFound();
  const publicProfile = profile as MemberProfileData;
  const avatarUrl = publicProfile.avatar_key && !["monogram", "dragon"].includes(publicProfile.avatar_key)
    ? supabase.storage.from("profile-avatars").getPublicUrl(publicProfile.avatar_key).data.publicUrl
    : undefined;
  return <PublicMemberProfile profile={publicProfile} avatarUrl={avatarUrl} isOwner={auth.user?.id === id} verifiedTrader={Boolean(traderProfile)} />;
}
