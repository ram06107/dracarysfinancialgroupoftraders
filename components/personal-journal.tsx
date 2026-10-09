"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { createJournalEntry, deleteJournalEntry, updateJournalEntry } from "@/app/actions/journal";
import { demoJournal } from "@/lib/demo-data";
import type { PersonalJournalEntry } from "@/lib/personal-journal";

const demoStorageKeys = { founder: "dracarys_journal_founder_v1", member: "dracarys_journal_member_v1" } as const;
type DemoRole = keyof typeof demoStorageKeys;

function day(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kampala" }).format(date);
}

function sampleEntries(): PersonalJournalEntry[] {
  return demoJournal.map((entry, index) => {
    const [date, month, year] = entry.date.split(" ");
    const months: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
    const entryDate = `${year}-${months[month] ?? "01"}-${date.padStart(2, "0")}`;
    return {
      id: `journal-sample-${index + 1}`, title: `${entry.instrument} session review`, market: entry.instrument, entry_date: entryDate,
      analysis: entry.body, risk_notes: entry.risk, result_notes: entry.lesson, psychology_notes: "Pause when the original reason for the trade no longer holds.",
      created_at: `${entryDate}T12:00:00.000Z`, updated_at: `${entryDate}T12:00:00.000Z`,
    };
  });
}

function fieldsFrom(form: HTMLFormElement, id: string) {
  const data = new FormData(form);
  return {
    id,
    title: String(data.get("title") ?? "").trim(),
    market: String(data.get("market") ?? "").trim().toUpperCase(),
    entry_date: String(data.get("entry_date") ?? ""),
    analysis: String(data.get("analysis") ?? "").trim(),
    risk_notes: String(data.get("risk_notes") ?? "").trim(),
    result_notes: String(data.get("result_notes") ?? "").trim(),
    psychology_notes: String(data.get("psychology_notes") ?? "").trim(),
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } satisfies PersonalJournalEntry;
}

function JournalFields({ entry, demoMode, onDemoSubmit, editing = false }: {
  entry?: PersonalJournalEntry;
  demoMode: boolean;
  onDemoSubmit?: (event: FormEvent<HTMLFormElement>, entryId?: string) => void;
  editing?: boolean;
}) {
  const action = demoMode ? undefined : editing ? updateJournalEntry : createJournalEntry;
  return <form className="journal-entry-form" action={action} encType="multipart/form-data" onSubmit={demoMode && onDemoSubmit ? (event) => onDemoSubmit(event, entry?.id) : undefined}>
    {editing && <input type="hidden" name="entry_id" value={entry?.id ?? ""} />}
    {editing && entry?.image_url && <div className="journal-current-image"><Image src={entry.image_url} alt={`Attached image for ${entry.title}`} width={1200} height={900} unoptimized /></div>}
    <div className="journal-form-row"><label>Entry title<input name="title" required minLength={2} maxLength={140} defaultValue={entry?.title ?? ""} placeholder="A note you can find later" /></label><label>Market<input name="market" maxLength={24} defaultValue={entry?.market ?? ""} placeholder="EURUSD, XAUUSD…" /></label><label>Date<input name="entry_date" type="date" required defaultValue={entry?.entry_date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(new Date())} /></label></div>
    <label>What did you see?<textarea name="analysis" maxLength={12000} defaultValue={entry?.analysis ?? ""} placeholder="The context, levels and reasoning behind the idea…" /></label>
    <div className="journal-form-row journal-form-notes"><label>Risk and invalidation<textarea name="risk_notes" maxLength={4000} defaultValue={entry?.risk_notes ?? ""} placeholder="What would prove the idea wrong?" /></label><label>Result and review<textarea name="result_notes" maxLength={4000} defaultValue={entry?.result_notes ?? ""} placeholder="What happened, and what will you carry forward?" /></label></div>
    <label>State of mind<textarea name="psychology_notes" maxLength={4000} defaultValue={entry?.psychology_notes ?? ""} placeholder="How were you thinking before and after the decision?" /></label>
    {demoMode ? <p className="journal-image-help">Sign in to save private journal images to your account.</p> : <label className="journal-image-field">Attach an image<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /><small>PNG, JPG, WEBP or GIF · up to 8 MB · private to your account</small></label>}
    {editing && entry?.image_url && !demoMode && <label className="journal-remove-image"><input name="remove_image" type="checkbox" value="true" /> Remove the saved image</label>}
    <div className="journal-form-actions"><span>{demoMode ? "Saved only in this browser." : "Private to your account."}</span><button className="button button-dark button-small" type="submit">{editing ? "Save changes" : "Save entry"}</button></div>
  </form>;
}

export function PersonalJournalPanel({ entries, error = false, status = "", demoRole }: {
  entries: PersonalJournalEntry[];
  error?: boolean;
  status?: string;
  demoRole?: DemoRole;
}) {
  const demoMode = Boolean(demoRole);
  const canEdit = (!demoMode || demoRole === "founder") && !error;
  const [demoEntries, setDemoEntries] = useState<PersonalJournalEntry[]>([]);
  const [ready, setReady] = useState(!demoMode);
  const [notice, setNotice] = useState("");
  const storageKey = demoRole ? demoStorageKeys[demoRole] : demoStorageKeys.founder;

  useEffect(() => {
    if (!demoMode) return;
    const samples = sampleEntries();
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only sample journal entries after hydration.
      setDemoEntries(Array.isArray(saved) ? saved as PersonalJournalEntry[] : samples);
      if (!Array.isArray(saved)) window.localStorage.setItem(storageKey, JSON.stringify(samples));
    } catch {
      setDemoEntries(samples);
      setNotice("Saved preview notes could not be read. The sample entries are shown instead.");
    }
    setReady(true);
  }, [demoMode, storageKey]);

  function persistDemo(next: PersonalJournalEntry[], message: string) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setDemoEntries(next);
      setNotice(message);
    } catch {
      setNotice("This browser could not save the journal update.");
    }
  }

  function saveDemo(event: FormEvent<HTMLFormElement>, entryId?: string) {
    event.preventDefault();
    if (!canEdit) return;
    const values = fieldsFrom(event.currentTarget, entryId ?? crypto.randomUUID());
    if (!values.title || !(values.analysis || values.risk_notes || values.result_notes || values.psychology_notes)) {
      setNotice("Add a title and at least one note before saving.");
      return;
    }
    if (entryId) persistDemo(demoEntries.map((entry) => entry.id === entryId ? values : entry), "Entry updated in this browser.");
    else persistDemo([values, ...demoEntries], "Entry saved in this browser.");
  }

  function removeDemo(event: FormEvent<HTMLFormElement>, entryId: string) {
    event.preventDefault();
    if (!canEdit || !window.confirm("Remove this journal entry from this browser?")) return;
    persistDemo(demoEntries.filter((entry) => entry.id !== entryId), "Entry removed from this browser.");
  }

  function editor(entry?: PersonalJournalEntry) {
    return <JournalFields entry={entry} demoMode={demoMode} onDemoSubmit={saveDemo} editing={Boolean(entry)} />;
  }

  const shownEntries = demoMode ? demoEntries : entries;
  return <section id="personal-journal" className="personal-journal" aria-labelledby="personal-journal-title">
    <header className="journal-heading"><div><p className="eyebrow eyebrow-dark">PRIVATE WORKSPACE</p><h2 id="personal-journal-title">Personal journal</h2><p>Keep your notes, chart images, risk and review beside each trading decision.</p></div><span>{demoMode ? "LOCAL PREVIEW" : "PRIVATE TO YOU"}</span></header>
    {status && <p className="journal-status" role="status">{status}</p>}
    {error && <p className="journal-status journal-status-error" role="status">Private journal storage is not ready. Apply the profile journal and journal image migrations in Supabase, then reload this page.</p>}
    {notice && <p className="journal-status" role="status">{notice}</p>}
    {demoMode && !ready && <p className="journal-status">Opening sample entries…</p>}
    {canEdit && <details className="journal-new-entry"><summary>Write a journal entry</summary>{editor()}</details>}
    {shownEntries.length === 0 && !error ? <div className="journal-empty"><strong>No journal entries yet.</strong><span>Start with written notes, a chart image, or both. Add the result when the idea is complete.</span></div> : <div className="journal-entry-list">{shownEntries.map((entry) => <details className="journal-entry" key={entry.id}>
      <summary><span className="journal-entry-date">{day(entry.entry_date)}</span><span className="journal-entry-summary"><strong>{entry.title}</strong><small>{entry.market || (entry.image_url ? "Image entry" : "General review")}</small></span><span className="journal-open-label">Read {canEdit ? "and edit" : "entry"}</span></summary>
      <div className="journal-entry-content">{canEdit ? <>{editor(entry)}<form className="journal-delete-form" action={demoMode ? undefined : deleteJournalEntry} onSubmit={demoMode ? (event) => removeDemo(event, entry.id) : undefined}><input type="hidden" name="entry_id" value={entry.id} /><button className="journal-delete-button" type="submit">Remove entry</button></form></> : <>{entry.image_url && <div className="journal-entry-image"><Image src={entry.image_url} alt={`Journal image for ${entry.title}`} width={1200} height={900} unoptimized /></div>}<div className="journal-readonly-notes">{entry.analysis && <section><h3>What did you see?</h3><p>{entry.analysis}</p></section>}{entry.risk_notes && <section><h3>Risk and invalidation</h3><p>{entry.risk_notes}</p></section>}{entry.result_notes && <section><h3>Result and review</h3><p>{entry.result_notes}</p></section>}{entry.psychology_notes && <section><h3>State of mind</h3><p>{entry.psychology_notes}</p></section>}</div></>}</div>
    </details>)}</div>}
    <p className="journal-privacy-note">Journal entries and attached images are private to your account. Sample notes in the demo stay in this browser.</p>
  </section>;
}
