"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const JOURNAL_IMAGE_BUCKET = "personal-journal-images";
const MAX_JOURNAL_IMAGE_SIZE = 8 * 1024 * 1024;
const JOURNAL_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function journalValues(formData: FormData, hasImage: boolean) {
  const values = {
    title: field(formData, "title"),
    market: field(formData, "market").toUpperCase(),
    entry_date: field(formData, "entry_date"),
    analysis: field(formData, "analysis"),
    risk_notes: field(formData, "risk_notes"),
    result_notes: field(formData, "result_notes"),
    psychology_notes: field(formData, "psychology_notes"),
  };
  const valid = values.title.length >= 2 && values.title.length <= 140 && values.market.length <= 24 &&
    validDate(values.entry_date) && values.analysis.length <= 12000 && values.risk_notes.length <= 4000 &&
    values.result_notes.length <= 4000 && values.psychology_notes.length <= 4000 &&
    Boolean(values.analysis || values.risk_notes || values.result_notes || values.psychology_notes || hasImage);
  return valid ? values : null;
}

function journalImage(formData: FormData) {
  const value = formData.get("image");
  return value instanceof File && value.size > 0 ? value : null;
}

async function isSupportedJournalImage(file: File) {
  if (file.size > MAX_JOURNAL_IMAGE_SIZE || !JOURNAL_IMAGE_TYPES[file.type]) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (file.type === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (file.type === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (file.type === "image/webp") return startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (file.type === "image/gif") return startsWith(0x47, 0x49, 0x46, 0x38) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
  return false;
}

async function uploadJournalImage(supabase: Awaited<ReturnType<typeof createClient>>, memberId: string, entryId: string, file: File) {
  const extension = JOURNAL_IMAGE_TYPES[file.type];
  const path = `${memberId}/${entryId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(JOURNAL_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  return error ? null : path;
}

async function ownerClient() {
  if (!hasSupabaseConfig()) redirect("/profile?journal=setup#personal-journal");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in?notice=join");
  return { supabase, memberId: data.user.id };
}

export async function createJournalEntry(formData: FormData) {
  const image = journalImage(formData);
  if (image && !(await isSupportedJournalImage(image))) redirect("/profile?journal=image#personal-journal");
  const values = journalValues(formData, Boolean(image));
  if (!values) redirect("/profile?journal=invalid#personal-journal");
  const { supabase, memberId } = await ownerClient();
  const entryId = crypto.randomUUID();
  const imageKey = image ? await uploadJournalImage(supabase, memberId, entryId, image) : null;
  if (image && !imageKey) redirect("/profile?journal=error#personal-journal");
  const { error } = await supabase.from("personal_journal_entries").insert({ ...values, id: entryId, image_key: imageKey, member_id: memberId });
  if (error) {
    if (imageKey) await supabase.storage.from(JOURNAL_IMAGE_BUCKET).remove([imageKey]);
    redirect("/profile?journal=error#personal-journal");
  }
  revalidatePath("/profile");
  redirect("/profile?journal=saved#personal-journal");
}

export async function updateJournalEntry(formData: FormData) {
  const entryId = field(formData, "entry_id");
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) redirect("/profile?journal=invalid#personal-journal");
  const { supabase, memberId } = await ownerClient();
  const { data: currentEntry, error: currentError } = await supabase.from("personal_journal_entries").select("id, image_key")
    .eq("id", entryId).eq("member_id", memberId).maybeSingle();
  if (currentError || !currentEntry) redirect("/profile?journal=error#personal-journal");
  const image = journalImage(formData);
  if (image && !(await isSupportedJournalImage(image))) redirect("/profile?journal=image#personal-journal");
  const removeImage = field(formData, "remove_image") === "true";
  const values = journalValues(formData, Boolean(image) || Boolean(currentEntry.image_key && !removeImage));
  if (!values) redirect("/profile?journal=invalid#personal-journal");
  const newImageKey = image ? await uploadJournalImage(supabase, memberId, entryId, image) : removeImage ? null : currentEntry.image_key;
  if (image && !newImageKey) redirect("/profile?journal=error#personal-journal");
  const { data, error } = await supabase.from("personal_journal_entries").update({ ...values, image_key: newImageKey, updated_at: new Date().toISOString() })
    .eq("id", entryId).eq("member_id", memberId).select("id").maybeSingle();
  if (error || !data) {
    if (image && newImageKey) await supabase.storage.from(JOURNAL_IMAGE_BUCKET).remove([newImageKey]);
    redirect("/profile?journal=error#personal-journal");
  }
  if (currentEntry.image_key && currentEntry.image_key !== newImageKey) await supabase.storage.from(JOURNAL_IMAGE_BUCKET).remove([currentEntry.image_key]);
  revalidatePath("/profile");
  redirect("/profile?journal=saved#personal-journal");
}

export async function deleteJournalEntry(formData: FormData) {
  const entryId = field(formData, "entry_id");
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) redirect("/profile?journal=invalid#personal-journal");
  const { supabase, memberId } = await ownerClient();
  const { data: currentEntry } = await supabase.from("personal_journal_entries").select("image_key")
    .eq("id", entryId).eq("member_id", memberId).maybeSingle();
  const { data, error } = await supabase.from("personal_journal_entries").delete()
    .eq("id", entryId).eq("member_id", memberId).select("id").maybeSingle();
  if (error || !data) redirect("/profile?journal=error#personal-journal");
  if (currentEntry?.image_key) await supabase.storage.from(JOURNAL_IMAGE_BUCKET).remove([currentEntry.image_key]);
  revalidatePath("/profile");
  redirect("/profile?journal=deleted#personal-journal");
}
