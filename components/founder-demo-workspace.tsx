"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DemoChartImage, type DemoChartVariant } from "@/components/demo-chart-image";

type FounderPost = { id: string; body: string; createdAt: string };
type FounderRecord = {
  id: string;
  instrument: string;
  direction: "BUY" | "SELL";
  entry: string;
  stop: string;
  target: string;
  thesis: string;
  createdAt: string;
};

const POSTS_KEY = "dracarys_founder_posts_v1";
const RECORDS_KEY = "dracarys_founder_records_v1";

function readLocal<T>(key: string): T[] {
  try {
    const saved = window.localStorage.getItem(key);
    const value: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

function showDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function FounderCommunityDesk() {
  const [posts, setPosts] = useState<FounderPost[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read founder-only local drafts after hydration.
    setPosts(readLocal<FounderPost>(POSTS_KEY));
    setReady(true);
  }, []);

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "").trim();
    if (!body || body.length > 12000) return;

    const next = [{ id: crypto.randomUUID(), body, createdAt: new Date().toISOString() }, ...posts];
    try {
      window.localStorage.setItem(POSTS_KEY, JSON.stringify(next));
      setPosts(next);
      form.reset();
      setNotice("Saved in this browser.");
    } catch {
      setNotice("This browser could not save the draft. Check its local storage settings and try again.");
    }
  }

  function remove(id: string) {
    const next = posts.filter((post) => post.id !== id);
    try {
      window.localStorage.setItem(POSTS_KEY, JSON.stringify(next));
      setPosts(next);
      setNotice("Your local post was removed.");
    } catch {
      setNotice("This browser could not update its local preview.");
    }
  }

  return (
    <section className="founder-desk" aria-label="Founder Trader local community workspace">
      <div className="founder-desk-heading"><div><span className="founder-desk-kicker">FOUNDER TRADER / LOCAL WORKSPACE</span><h2>Write to the room.</h2></div><span className="founder-access-stamp">FULL PREVIEW ACCESS</span></div>
      <p className="founder-desk-intro">Draft a market note or a lighter desk post. It stays on this device and is visible only in this preview.</p>
      <form className="founder-write-form" onSubmit={publish}>
        <label className="sr-only" htmlFor="founder-post-body">Write a post</label>
        <textarea id="founder-post-body" name="body" maxLength={12000} required placeholder="What did you notice, and what would change your view?" />
        <div><span>{ready ? "Local preview · not published to a live community" : "Opening your local workspace…"}</span><button className="button button-dark button-small" type="submit" disabled={!ready}>Save post <span aria-hidden="true"></span></button></div>
      </form>
      {notice && <p className="founder-save-note" role="status">{notice}</p>}
      {ready && posts.length > 0 && <div className="founder-local-posts">
        <div className="founder-local-heading"><strong>Your local posts</strong><span>{posts.length} saved here</span></div>
        {posts.map((post) => <article className="founder-local-post" key={post.id}>
          <div className="founder-local-post-meta"><strong>Founder Trader</strong><time>{showDate(post.createdAt)}</time><button type="button" onClick={() => remove(post.id)}>Remove</button></div>
          <p>{post.body}</p>
          <DemoChartImage variant="range" caption="ILLUSTRATIVE NOTE IMAGE · NO LIVE PRICE DATA" />
        </article>)}
      </div>}
    </section>
  );
}

export function FounderRecordDesk() {
  const [records, setRecords] = useState<FounderRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read founder-only local records after hydration.
    setRecords(readLocal<FounderRecord>(RECORDS_KEY));
    setReady(true);
  }, []);

  function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const record: FounderRecord = {
      id: crypto.randomUUID(),
      instrument: String(data.get("instrument") ?? "XAUUSD"),
      direction: data.get("direction") === "SELL" ? "SELL" : "BUY",
      entry: String(data.get("entry") ?? "").trim(),
      stop: String(data.get("stop") ?? "").trim(),
      target: String(data.get("target") ?? "").trim(),
      thesis: String(data.get("thesis") ?? "").trim(),
      createdAt: new Date().toISOString(),
    };
    if (!record.thesis) return;
    const next = [record, ...records];
    try {
      window.localStorage.setItem(RECORDS_KEY, JSON.stringify(next));
      setRecords(next);
      form.reset();
      setNotice("Setup saved in this browser. No outcome has been assigned.");
    } catch {
      setNotice("This browser could not save the setup. Check its local storage settings and try again.");
    }
  }

  function removeRecord(id: string) {
    const next = records.filter((record) => record.id !== id);
    try {
      window.localStorage.setItem(RECORDS_KEY, JSON.stringify(next));
      setRecords(next);
      setNotice("Your local setup was removed.");
    } catch {
      setNotice("This browser could not update its local preview.");
    }
  }

  return (
    <section className="founder-record-desk" aria-label="Founder Trader local record workspace">
      <div className="founder-desk-heading"><div><span className="founder-desk-kicker">FOUNDER TRADER / PRIVATE TO THIS BROWSER</span><h2>Keep a working setup.</h2></div><span className="founder-access-stamp">LOCAL DRAFTS</span></div>
      <p className="founder-desk-intro">Add a thesis and the levels you are watching. New entries stay open until you review them; this workspace does not send orders or change the sample analytics.</p>
      <div className="founder-record-layout">
        <form className="founder-record-form" onSubmit={saveRecord}>
          <label>Market<select name="instrument" defaultValue="XAUUSD"><option>XAUUSD</option><option>EURUSD</option><option>GBPUSD</option><option>BTCUSD</option></select></label>
          <label>View<select name="direction" defaultValue="BUY"><option>BUY</option><option>SELL</option></select></label>
          <label>Entry area<input name="entry" maxLength={80} placeholder="Optional" /></label>
          <label>Invalidation<input name="stop" maxLength={80} placeholder="Optional" /></label>
          <label>Target idea<input name="target" maxLength={80} placeholder="Optional" /></label>
          <label className="founder-record-thesis">Reasoning<textarea name="thesis" maxLength={2400} required placeholder="What is the idea based on, and what would prove it wrong?" /></label>
          <button className="button button-dark button-small" type="submit" disabled={!ready}>Save open setup <span aria-hidden="true"></span></button>
        </form>
        <DemoChartImage variant="rejection" caption="ILLUSTRATIVE MARKUP · NOT LIVE MARKET DATA" />
      </div>
      {notice && <p className="founder-save-note" role="status">{notice}</p>}
      {ready && <div className="founder-local-records">
        <div className="founder-local-heading"><strong>Your open setups</strong><span>{records.length} saved here · no outcomes recorded</span></div>
        {records.length === 0 ? <p className="founder-empty-note">No local setups yet. Add one above to see it in this workspace.</p> : records.map((record) => {
          const chartVariant: DemoChartVariant = record.direction === "SELL" ? "rejection" : "breakout";
          return <article className="founder-record-item" key={record.id}>
            <div className="founder-record-item-top"><div><span>{record.instrument} / {record.direction}</span><time>{showDate(record.createdAt)}</time></div><button type="button" onClick={() => removeRecord(record.id)}>Remove</button></div>
            <p>{record.thesis}</p>
            <div className="demo-levels founder-record-levels"><div><span>ENTRY AREA</span><strong>{record.entry || "Not set"}</strong></div><div><span>INVALIDATION</span><strong>{record.stop || "Not set"}</strong></div><div><span>TARGET IDEA</span><strong>{record.target || "Not set"}</strong></div></div>
            <DemoChartImage variant={chartVariant} caption="YOUR LOCAL SETUP · OUTCOME NOT RECORDED" />
            <small>OPEN / NO OUTCOME ASSIGNED</small>
          </article>;
        })}
      </div>}
    </section>
  );
}
