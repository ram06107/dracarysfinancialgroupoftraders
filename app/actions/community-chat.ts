"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const supportedKinds = new Set(["chat", "signal", "setup", "file"]);
const supportedMime = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/csv"]);
const extensionMime: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf", txt: "text/plain", csv: "text/csv" };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function signedIn() {
  if (!hasSupabaseConfig()) redirect("/community?error=setup");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in?notice=join");
  return { supabase, user: data.user };
}

function returnToRoom(code = "sent") {
  revalidatePath("/community");
  redirect(code ? `/community?${code}=1` : "/community");
}

export async function sendCommunityMessage(formData: FormData) {
  const kind = text(formData, "message_kind") || "chat";
  const body = text(formData, "body");
  const selected = formData.get("attachment");
  const file = typeof File !== "undefined" && selected instanceof File && selected.size > 0 ? selected : null;
  const replyTo = text(formData, "reply_to_message_id") || null;
  if (!supportedKinds.has(kind) || (!body && !file) || body.length > 8000 || (kind === "file" && !file) || (replyTo && !/^[\da-f-]{36}$/i.test(replyTo))) {
    redirect("/community?error=chat");
  }
  if (file && file.size > 10_000_000) redirect("/community?error=file");
  const extension = file?.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file ? (file.type || extensionMime[extension] || "") : "";
  if (file && !supportedMime.has(mime)) redirect("/community?error=file");

  const instrument = text(formData, "instrument").toUpperCase();
  if ((kind === "signal" || kind === "setup") && (!instrument || instrument.length > 20)) redirect("/community?error=chat");
  const direction = text(formData, "direction") === "SELL" ? "SELL" : "BUY";
  const { supabase, user } = await signedIn();
  const roomResult = await supabase.rpc("ensure_community_room");
  if (roomResult.error || typeof roomResult.data !== "string") redirect("/community?error=chat");
  if (replyTo) {
    const { data: reply, error: replyError } = await supabase.from("messages").select("id")
      .eq("id", replyTo).eq("room_id", roomResult.data).is("removed_at", null).maybeSingle();
    if (replyError || !reply) redirect("/community?error=chat");
  }

  let attachmentKey: string | null = null;
  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-120) || "shared-file";
    attachmentKey = `${user.id}/community/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("community-files").upload(attachmentKey, file, { contentType: mime, cacheControl: "3600", upsert: false });
    if (error) redirect("/community?error=file");
  }

  const { error } = await supabase.from("messages").insert({
    room_id: roomResult.data,
    author_id: user.id,
    body: body || (mime.startsWith("image/") ? "Shared an image." : "Shared a file."),
    message_kind: kind,
    instrument: kind === "signal" || kind === "setup" ? instrument : null,
    direction: kind === "signal" || kind === "setup" ? direction : null,
    entry_zone: text(formData, "entry_zone") || null,
    invalidation: text(formData, "invalidation") || null,
    target_idea: text(formData, "target_idea") || null,
    attachment_key: attachmentKey,
    attachment_name: file?.name ?? null,
    attachment_mime: file ? mime : null,
    attachment_size: file?.size ?? null,
    reply_to_message_id: replyTo,
  });
  if (error) {
    if (attachmentKey) await supabase.storage.from("community-files").remove([attachmentKey]);
    redirect("/community?error=chat");
  }
  returnToRoom("sent");
}

export async function toggleCommunityReaction(formData: FormData) {
  const messageId = text(formData, "message_id");
  const reaction = text(formData, "reaction");
  if (!/^[\da-f-]{36}$/i.test(messageId) || !["like", "love", "fire", "think", "eyes"].includes(reaction)) redirect("/community?error=reaction");
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("toggle_community_reaction", { p_message_id: messageId, p_reaction: reaction });
  if (error) redirect("/community?error=reaction");
  returnToRoom("");
}

export async function editCommunityMessage(formData: FormData) {
  const messageId = text(formData, "message_id");
  const body = text(formData, "body");
  if (!/^[\da-f-]{36}$/i.test(messageId) || !body || body.length > 8000) redirect("/community?error=edit");
  const { supabase, user } = await signedIn();
  const { error } = await supabase.from("messages").update({ body, edited_at: new Date().toISOString() }).eq("id", messageId).eq("author_id", user.id);
  if (error) redirect("/community?error=edit");
  returnToRoom("");
}

export async function removeCommunityMessage(formData: FormData) {
  const messageId = text(formData, "message_id");
  if (!/^[\da-f-]{36}$/i.test(messageId)) redirect("/community?error=edit");
  const { supabase, user } = await signedIn();
  const { data: message, error: lookupError } = await supabase.from("messages").select("attachment_key").eq("id", messageId).eq("author_id", user.id).maybeSingle();
  if (lookupError || !message) redirect("/community?error=edit");
  const { error } = await supabase.from("messages").update({ removed_at: new Date().toISOString() }).eq("id", messageId).eq("author_id", user.id);
  if (error) redirect("/community?error=edit");
  if (message.attachment_key) await supabase.storage.from("community-files").remove([message.attachment_key]);
  returnToRoom("");
}
