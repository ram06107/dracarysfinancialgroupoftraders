"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function updatePublicProfile(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/profile?error=unavailable");
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/sign-in?notice=join");
  const publicName = field(formData, "public_name");
  const bio = field(formData, "bio");
  const requestedAvatar = field(formData, "avatar_key");
  const sharePerformance = formData.get("share_performance") === "on";
  const selectedPhoto = formData.get("avatar_file");
  const file = typeof File !== "undefined" && selectedPhoto instanceof File && selectedPhoto.size > 0 ? selectedPhoto : null;
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (publicName.length < 2 || publicName.length > 80 || bio.length > 500 || !["monogram", "dragon", "keep"].includes(requestedAvatar) || (file && (!allowedTypes.has(file.type) || file.size > 2_000_000))) {
    redirect("/profile?error=details");
  }

  const { data: currentProfile, error: currentError } = await supabase
    .from("public_member_profiles")
    .select("avatar_key")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (currentError || !currentProfile) redirect("/profile?error=save");

  let newAvatarPath: string | null = null;
  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "profile-image";
    newAvatarPath = `${auth.user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(newAvatarPath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) redirect("/profile?error=photo");
  }

  const oldAvatar = currentProfile.avatar_key;
  const avatarKey = newAvatarPath ?? (requestedAvatar === "keep" ? oldAvatar ?? "monogram" : requestedAvatar);

  const { data: savedProfile, error } = await supabase
    .from("public_member_profiles")
    .update({ public_name: publicName, bio, avatar_key: avatarKey, share_performance: sharePerformance })
    .eq("id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error || !savedProfile) {
    if (newAvatarPath) await supabase.storage.from("profile-avatars").remove([newAvatarPath]);
    redirect("/profile?error=save");
  }

  if (oldAvatar && !["monogram", "dragon"].includes(oldAvatar) && oldAvatar !== avatarKey) {
    await supabase.storage.from("profile-avatars").remove([oldAvatar]);
  }

  revalidatePath("/profile");
  revalidatePath("/community");
  revalidatePath(`/members/${auth.user.id}`);
  redirect("/profile?saved=1");
}
