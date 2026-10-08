import { createClient } from "@/lib/supabase/server";

export type PersonalJournalEntry = {
  id: string;
  title: string;
  market: string;
  entry_date: string;
  analysis: string;
  risk_notes: string;
  result_notes: string;
  psychology_notes: string;
  created_at: string;
  updated_at: string;
};

export async function getPersonalJournal(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("personal_journal_entries")
    .select("id, title, market, entry_date, analysis, risk_notes, result_notes, psychology_notes, created_at, updated_at")
    .eq("member_id", memberId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  return { entries: (data ?? []) as PersonalJournalEntry[], error: Boolean(error) };
}
