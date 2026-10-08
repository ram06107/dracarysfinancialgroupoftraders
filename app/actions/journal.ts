"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function journalValues(formData: FormData) {
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
    Boolean(values.analysis || values.risk_notes || values.result_notes || values.psychology_notes);
  return valid ? values : null;
}

async function ownerClient() {
  if (!hasSupabaseConfig()) redirect("/profile?journal=setup#personal-journal");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in?notice=join");
  return { supabase, memberId: data.user.id };
}

export async function createJournalEntry(formData: FormData) {
  const values = journalValues(formData);
  if (!values) redirect("/profile?journal=invalid#personal-journal");
  const { supabase, memberId } = await ownerClient();
  const { error } = await supabase.from("personal_journal_entries").insert({ ...values, member_id: memberId });
  if (error) redirect("/profile?journal=error#personal-journal");
  revalidatePath("/profile");
  redirect("/profile?journal=saved#personal-journal");
}

export async function updateJournalEntry(formData: FormData) {
  const values = journalValues(formData);
  const entryId = field(formData, "entry_id");
  if (!values || !/^[0-9a-f-]{36}$/i.test(entryId)) redirect("/profile?journal=invalid#personal-journal");
  const { supabase, memberId } = await ownerClient();
  const { data, error } = await supabase.from("personal_journal_entries").update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", entryId).eq("member_id", memberId).select("id").maybeSingle();
  if (error || !data) redirect("/profile?journal=error#personal-journal");
  revalidatePath("/profile");
  redirect("/profile?journal=saved#personal-journal");
}

export async function deleteJournalEntry(formData: FormData) {
  const entryId = field(formData, "entry_id");
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) redirect("/profile?journal=invalid#personal-journal");
  const { supabase, memberId } = await ownerClient();
  const { data, error } = await supabase.from("personal_journal_entries").delete()
    .eq("id", entryId).eq("member_id", memberId).select("id").maybeSingle();
  if (error || !data) redirect("/profile?journal=error#personal-journal");
  revalidatePath("/profile");
  redirect("/profile?journal=deleted#personal-journal");
}
