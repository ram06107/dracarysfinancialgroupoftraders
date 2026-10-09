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
  image_url?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getPersonalJournal(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("personal_journal_entries")
    .select("id, title, market, entry_date, analysis, risk_notes, result_notes, psychology_notes, image_key, created_at, updated_at")
    .eq("member_id", memberId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const entries = await Promise.all((data ?? []).map(async (entry) => {
    let imageUrl: string | null = null;
    if (entry.image_key) {
      const { data: signedImage } = await supabase.storage.from("personal-journal-images").createSignedUrl(entry.image_key, 60 * 60);
      imageUrl = signedImage?.signedUrl ?? null;
    }
    return { ...entry, image_url: imageUrl } as PersonalJournalEntry;
  }));

  return { entries, error: Boolean(error) };
}
