"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

function textField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function returnPath(formData: FormData) {
  return textField(formData, "return_to") === "/feed" ? "/feed" : "/community";
}

async function signedInClient() {
  if (!hasSupabaseConfig()) redirect("/community?error=setup");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in?notice=join");
  return { supabase, userId: data.user.id };
}

export async function publishPost(formData: FormData) {
  const destination = returnPath(formData);
  const kindValue = textField(formData, "post_kind");
  const kind = ["chat", "signal", "setup", "file"].includes(kindValue) ? kindValue : "chat";
  const selectedFile = formData.get("attachment");
  const file = typeof File !== "undefined" && selectedFile instanceof File && selectedFile.size > 0 ? selectedFile : null;
  const submittedBody = textField(formData, "body");
  if ((kind !== "file" && !submittedBody) || submittedBody.length > 12000 || (kind === "file" && !file)) {
    redirect(`${destination}?error=post`);
  }
  if (file && file.size > 10_000_000) redirect(`${destination}?error=post`);

  const allowedMime = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/csv"]);
  const extensionMime: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf", txt: "text/plain", csv: "text/csv" };
  const extension = file?.name.split(".").pop()?.toLowerCase() ?? "";
  const attachmentMime = file ? (file.type || extensionMime[extension] || "") : "";
  if (file && !allowedMime.has(attachmentMime)) redirect(`${destination}?error=post`);
  const body = submittedBody || (file ? `Shared file: ${file.name}` : "");

  const instrument = textField(formData, "instrument").toUpperCase();
  const directionValue = textField(formData, "direction");
  const direction = directionValue === "SELL" ? "SELL" : "BUY";
  if ((kind === "signal" || kind === "setup") && (!instrument || instrument.length > 20)) redirect(`${destination}?error=post`);
  const { supabase, userId } = await signedInClient();
  const { data: canPublish, error: permissionError } = await supabase.rpc("request_can_publish_feed");
  if (permissionError || canPublish !== true) redirect(`${destination}?error=trader_only`);

  let attachmentPath: string | null = null;
  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-120) || "shared-file";
    attachmentPath = `${userId}/feed/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("community-files").upload(attachmentPath, file, {
      contentType: attachmentMime,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) redirect(`${destination}?error=post`);
  }

  const { error } = await supabase.from("posts").insert({
    author_id: userId,
    body,
    visibility: "public",
    post_kind: kind,
    instrument: kind === "signal" || kind === "setup" ? instrument : null,
    direction: kind === "signal" || kind === "setup" ? direction : null,
    entry_zone: textField(formData, "entry_zone") || null,
    invalidation: textField(formData, "invalidation") || null,
    target_idea: textField(formData, "target_idea") || null,
    attachment_key: attachmentPath,
    attachment_name: file?.name ?? null,
    attachment_mime: file ? attachmentMime : null,
    attachment_size: file?.size ?? null,
  });
  if (error) {
    if (attachmentPath) await supabase.storage.from("community-files").remove([attachmentPath]);
    redirect(`${destination}?error=post`);
  }
  revalidatePath("/feed");
  revalidatePath("/community");
  redirect(`${destination}?posted=1`);
}

export async function addComment(formData: FormData) {
  const destination = returnPath(formData);
  const postId = textField(formData, "post_id");
  const body = textField(formData, "body");
  if (!/^[0-9a-f-]{36}$/i.test(postId) || !body || body.length > 6000) {
    redirect(`${destination}?error=comment`);
  }

  const { supabase, userId } = await signedInClient();
  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: userId,
    body,
  });
  if (error) redirect(`${destination}?error=comment`);
  revalidatePath("/feed");
  revalidatePath("/community");
  redirect(`${destination}?replied=1`);
}

export async function toggleReaction(formData: FormData) {
  const destination = returnPath(formData);
  const postId = textField(formData, "post_id");
  const reaction = textField(formData, "reaction");
  if (
    !/^[0-9a-f-]{36}$/i.test(postId) ||
    !["like", "insightful", "question"].includes(reaction)
  ) {
    redirect(`${destination}?error=reaction`);
  }

  const { supabase, userId } = await signedInClient();
  const lookup = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("member_id", userId)
    .eq("reaction", reaction)
    .maybeSingle();

  if (lookup.error) redirect(`${destination}?error=reaction`);
  const result = lookup.data
    ? await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("member_id", userId)
        .eq("reaction", reaction)
    : await supabase.from("post_reactions").insert({
        post_id: postId,
        member_id: userId,
        reaction,
      });

  if (result.error) redirect(`${destination}?error=reaction`);
  revalidatePath("/feed");
  revalidatePath("/community");
  redirect(destination);
}

export async function deleteCommunityPost(formData: FormData) {
  const destination = returnPath(formData);
  const postId = textField(formData, "post_id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
    redirect(`${destination}?error=delete`);
  }

  const { supabase } = await signedInClient();
  const { data: attachmentKey, error } = await supabase.rpc("remove_community_post", { p_post_id: postId });
  if (error) redirect(`${destination}?error=delete`);

  revalidatePath("/feed");
  revalidatePath("/community");

  if (typeof attachmentKey === "string" && attachmentKey) {
    const { error: attachmentError } = await supabase.storage.from("community-files").remove([attachmentKey]);
    if (attachmentError) redirect(`${destination}?error=delete_attachment`);
  }

  redirect(`${destination}?deleted=1`);
}
