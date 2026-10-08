"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ProfileAvatar } from "@/components/profile-avatar";
import { RailIcon } from "@/components/rail-icon";
import { DemoChartImage, type DemoChartVariant } from "@/components/demo-chart-image";

type RoomKind = "chat" | "signal" | "setup" | "file";
type RoomAttachment = { name: string; type: string; size: number; dataUrl: string };
type RoomReply = { id: string; author: string; body: string; createdAt: string };
type RoomPost = {
  id: string;
  kind: RoomKind;
  author: string;
  createdAt: string;
  body: string;
  instrument?: string;
  direction?: "BUY" | "SELL";
  entry?: string;
  invalidation?: string;
  target?: string;
  sampleResult?: string;
  chartVariant?: DemoChartVariant;
  attachment?: RoomAttachment;
  replies: RoomReply[];
  useful: number;
  questions: number;
  reactionCounts?: Partial<Record<"like" | "love" | "fire" | "think" | "eyes", number>>;
  myReactions: string[];
  mine?: boolean;
};

const ROOM_KEY = "dracarys_community_room_v1";
const LEGACY_POSTS_KEY = "dracarys_founder_posts_v1";
const MAX_FILE_BYTES = 1_000_000;
const messageModes: { label: string; value: RoomKind }[] = [
  { label: "Message", value: "chat" }, { label: "Signal", value: "signal" }, { label: "Setup", value: "setup" }, { label: "File", value: "file" },
];
const reactions = [
  { key: "like", icon: "👍", label: "Like" }, { key: "love", icon: "❤️", label: "Love" }, { key: "fire", icon: "🔥", label: "Fire" }, { key: "think", icon: "🤔", label: "Thinking" }, { key: "eyes", icon: "👀", label: "Eyes" },
] as const;

function dateAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function sampleFile() {
  const text = "DRACARYS · SAMPLE WORKSHEET\n\nBefore the session\n- Mark the levels that matter\n- Note the condition that would change your view\n- Decide your risk before an entry\n- Record when standing aside is the plan\n\nFictional example for preview only.\n";
  return {
    name: "weekly-prep-checklist.txt",
    type: "text/plain",
    size: new Blob([text]).size,
    dataUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
  };
}

function samplePosts(): RoomPost[] {
  return [
    {
      id: "sample-chat-1", kind: "chat", author: "Demo trader 01", createdAt: dateAgo(24),
      body: "Morning desk check: the first move out of the London range has been messy. I’m waiting for a close and a hold before I call it a break. Anyone else watching that level?",
      replies: [
        { id: "sample-reply-1", author: "Demo member", body: "Same here. A wick through the edge hasn’t changed my view yet.", createdAt: dateAgo(17) },
        { id: "sample-reply-2", author: "Demo trader 02", body: "I marked the range before the open. If it stays inside, no trade is still a decision.", createdAt: dateAgo(12) },
      ], useful: 4, questions: 1, myReactions: [],
    },
    {
      id: "sample-signal-1", kind: "signal", author: "Demo trader 02", createdAt: dateAgo(78),
      instrument: "XAUUSD", direction: "SELL", entry: "2,631–2,635", invalidation: "Above 2,641", target: "2,620 idea",
      body: "Historical scenario from the sample record: price tested the prior range edge and failed to hold above it. This is an illustration of how to write down a thesis and its invalidation, not a live call.",
      chartVariant: "rejection", replies: [{ id: "sample-reply-3", author: "Demo member", body: "Thanks for including what would invalidate the idea. That makes the level easier to discuss.", createdAt: dateAgo(63) }],
      useful: 7, questions: 2, myReactions: [],
    },
    {
      id: "sample-setup-1", kind: "setup", author: "Demo member", createdAt: dateAgo(163),
      instrument: "EURUSD", direction: "BUY", entry: "1.1710–1.1720", invalidation: "Below 1.1685", target: "1.1770 idea", sampleResult: "SAMPLE RESULT · LOSS",
      body: "The example reclaim did not hold and the setup later failed. The trader’s execution was recorded as skipped, separately from the public idea. Keeping those records apart makes the review clearer.",
      chartVariant: "breakout", replies: [{ id: "sample-reply-4", author: "Demo trader 01", body: "Exactly. A published idea is not proof that every reader took the trade.", createdAt: dateAgo(140) }],
      useful: 5, questions: 0, myReactions: [],
    },
    {
      id: "sample-chat-2", kind: "chat", author: "Demo trader 03", createdAt: dateAgo(245),
      body: "A market tradition: price spends an hour going nowhere, then chooses a direction the moment I step away to make coffee. I’m adding ‘take a break’ to the plan, not chasing the candle.",
      replies: [{ id: "sample-reply-5", author: "Demo member", body: "Coffee is the only position I can guarantee I’ll manage properly.", createdAt: dateAgo(226) }],
      useful: 3, questions: 0, myReactions: [],
    },
    {
      id: "sample-file-1", kind: "file", author: "Demo trader 01", createdAt: dateAgo(380),
      body: "A small session-prep checklist for the room. Download the plain-text sample and adapt it to your own process.",
      attachment: sampleFile(), replies: [], useful: 2, questions: 0, myReactions: [],
    },
  ];
}

function readSavedPosts(): RoomPost[] | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(ROOM_KEY) ?? "null");
    if (!Array.isArray(value)) return null;
    return value.filter((item): item is RoomPost => Boolean(item && typeof item.id === "string" && typeof item.body === "string"));
  } catch {
    return null;
  }
}

function readLegacyPosts(): RoomPost[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(LEGACY_POSTS_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item.body === "string").map((item) => ({
      id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
      kind: "chat" as const,
      author: "Founder Trader",
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      body: item.body,
      replies: [], useful: 0, questions: 0, myReactions: [], mine: true,
    }));
  } catch {
    return [];
  }
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 0 : 1)} KB`;
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read that file."));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "M";
}

function TypeIcon({ kind }: { kind: RoomKind }) {
  const label = kind === "chat" ? "CHAT" : kind === "signal" ? "SIGNAL" : kind === "setup" ? "SETUP" : "FILE";
  return <span className={`room-type-icon room-type-${kind}`} aria-hidden="true">{label}</span>;
}

export function CommunityRoomPreview({ name, readOnly = false, profileStorageKey }: { name: string; readOnly?: boolean; profileStorageKey?: string }) {
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [profileName, setProfileName] = useState(name);
  const [avatarKey, setAvatarKey] = useState<string>("monogram");
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<RoomKind>("chat");
  const [search, setSearch] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [openReply, setOpenReply] = useState<string | null>(null);
  const timelineEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readSavedPosts();
    if (saved?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only preview data after hydration.
      setPosts(saved);
    } else {
      const seeded = [...readLegacyPosts(), ...samplePosts()];
      setPosts(seeded);
      try { window.localStorage.setItem(ROOM_KEY, JSON.stringify(seeded)); } catch { /* The read-only examples remain visible. */ }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync the local preview profile after hydration.
    setProfileName(name);
    setAvatarKey("monogram");
    if (!profileStorageKey) return;
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(profileStorageKey) ?? "null");
      if (!saved || typeof saved !== "object") return;
      const profile = saved as { public_name?: unknown; avatar_key?: unknown };
      if (typeof profile.public_name === "string" && profile.public_name.trim()) setProfileName(profile.public_name.slice(0, 80));
      if (typeof profile.avatar_key === "string" && (profile.avatar_key === "dragon" || profile.avatar_key.startsWith("data:image/"))) setAvatarKey(profile.avatar_key);
    } catch { /* Keep the account name and initials if browser storage is unavailable. */ }
  }, [name, profileStorageKey]);

  const visiblePosts = useMemo(() => posts.filter((post) => {
    const searchText = `${post.author} ${post.body} ${post.instrument ?? ""} ${post.attachment?.name ?? ""}`.toLowerCase();
    return searchText.includes(search.trim().toLowerCase());
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [posts, search]);

  useEffect(() => {
    timelineEnd.current?.scrollIntoView({ block: "end" });
  }, [ready, visiblePosts.length]);

  function save(next: RoomPost[], successMessage: string) {
    try {
      window.localStorage.setItem(ROOM_KEY, JSON.stringify(next));
      setPosts(next);
      setNotice(successMessage);
      return true;
    } catch {
      setNotice("This browser could not save the change. Try a smaller file or clear some browser storage.");
      return false;
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "").trim();
    const file = pickedFile;
    if (kind !== "file" && !body) { setNotice("Add a message before sharing."); return; }
    if (kind === "file" && !file) { setNotice("Choose a file to share with the room."); return; }
    if (file && file.size > MAX_FILE_BYTES) { setNotice("Files in this local preview must be 1 MB or smaller."); return; }
    if (file && file.type && !["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/csv"].includes(file.type)) {
      setNotice("Choose an image, PDF, plain-text, or CSV file for this preview."); return;
    }

    let attachment: RoomAttachment | undefined;
    if (file) {
      try { attachment = { name: file.name, type: file.type || "application/octet-stream", size: file.size, dataUrl: await readFile(file) }; }
      catch { setNotice("That file could not be read. Choose it again and retry."); return; }
    }

    const direction = data.get("direction") === "SELL" ? "SELL" as const : "BUY" as const;
    const nextPost: RoomPost = {
      id: crypto.randomUUID(), kind, author: profileName, createdAt: new Date().toISOString(), body,
      instrument: kind === "signal" || kind === "setup" ? String(data.get("instrument") ?? "XAUUSD") : undefined,
      direction: kind === "signal" || kind === "setup" ? direction : undefined,
      entry: kind === "signal" || kind === "setup" ? String(data.get("entry") ?? "").trim() : undefined,
      invalidation: kind === "signal" || kind === "setup" ? String(data.get("invalidation") ?? "").trim() : undefined,
      target: kind === "signal" || kind === "setup" ? String(data.get("target") ?? "").trim() : undefined,
      attachment,
      replies: [], useful: 0, questions: 0, myReactions: [], mine: true,
    };
    const next = [nextPost, ...posts];
    if (save(next, `${kind === "chat" ? "Message" : kind === "signal" ? "Signal" : kind === "setup" ? "Setup" : "File"} shared in this browser preview.`)) {
      form.reset();
      setPickedFile(null);
      setKind("chat");
    }
  }

  function addReply(postId: string, form: HTMLFormElement) {
    if (readOnly) return;
    const data = new FormData(form);
    const body = String(data.get("reply") ?? "").trim();
    if (!body) return;
    const reply: RoomReply = { id: crypto.randomUUID(), author: profileName, body, createdAt: new Date().toISOString() };
    const next = posts.map((post) => post.id === postId ? { ...post, replies: [...post.replies, reply] } : post);
    if (save(next, "Reply added to the conversation.")) { form.reset(); setOpenReply(null); }
  }

  function react(postId: string, reaction: (typeof reactions)[number]["key"]) {
    if (readOnly) return;
    const next = posts.map((post) => {
      if (post.id !== postId) return post;
      const legacy = reaction === "like" ? "useful" : reaction === "think" ? "question" : reaction;
      const active = post.myReactions.includes(reaction) || post.myReactions.includes(legacy);
      const counts = { like: post.useful, love: 0, fire: 0, think: post.questions, eyes: 0, ...post.reactionCounts };
      counts[reaction] = Math.max(0, counts[reaction] + (active ? -1 : 1));
      const myReactions = post.myReactions.filter((item) => item !== reaction && item !== legacy);
      if (!active) myReactions.push(reaction);
      return {
        ...post,
        useful: counts.like,
        questions: counts.think,
        reactionCounts: counts,
        myReactions,
      };
    });
    save(next, "Reaction saved in this browser.");
  }

  function remove(postId: string) {
    if (readOnly) return;
    const next = posts.filter((post) => post.id !== postId);
    save(next, "Your local post was removed.");
  }

  return (
    <section className="public-chat-shell" aria-label="The DRACARYS public group chat preview">
      <nav className="chat-app-rail" aria-label="DRACARYS pages">
        <Link className="chat-rail-brand" href="/" aria-label="DRACARYS home"><BrandMark small /></Link>
        <Link className="chat-rail-link chat-rail-current" href="/community" aria-current="page"><RailIcon name="chats" /><span>Chats</span></Link>
        <Link className="chat-rail-link" href="/feed"><RailIcon name="feed" /><span>Feed</span></Link>
        <Link className="chat-rail-link" href="/traders"><RailIcon name="traders" /><span>Traders</span></Link>
        <Link className="chat-rail-link" href="/record"><RailIcon name="record" /><span>Record</span></Link>
        <Link className="chat-rail-link" href="/analytics"><RailIcon name="analytics" /><span>Analytics</span></Link>
        <div className="chat-rail-bottom"><Link className="chat-rail-link" href="/profile"><RailIcon name="profile" /><span>Profile</span></Link></div>
      </nav>
      <aside className="public-chat-sidebar">
        <div className="public-chat-sidebar-head"><h1>Chats</h1><span>LOCAL PREVIEW</span></div>
        <label className="public-chat-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search group messages</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" /></label>
        <div className="public-chat-list-label">PUBLIC GROUP <span>1 chat</span></div>
        <div className="public-chat-room-active" aria-current="page"><span className="public-chat-room-icon"><BrandMark small /></span><div><strong>DRACARYS Community</strong><small>{visiblePosts[0]?.body || "The shared public room"}</small></div><i /></div>
        <div className="public-chat-member"><ProfileAvatar name={profileName} avatarKey={avatarKey} size="small" /><div><strong>{readOnly ? "Demo member" : profileName}</strong><small>{readOnly ? "Read-only preview" : "Founder demo"}</small></div></div>
      </aside>

      <div className="public-chat-main">
        <header className="public-chat-header"><span className="public-chat-room-icon"><BrandMark small /></span><div><h2>The DRACARYS Community</h2><p>Public group chat <span>·</span> One shared room</p></div><span className="public-chat-status public-chat-status-demo"><i />LOCAL PREVIEW</span></header>
        <div className="public-chat-data"><strong>DEMO DATA</strong> Fictional conversation samples. Your preview messages stay in this browser.</div>
        {readOnly && <div className="public-chat-readonly">You can browse the conversation. Choose Founder Trader Demo to try sending messages in this local preview.</div>}
        <div className="public-chat-scroll" ref={timelineEnd} role="log" aria-label="Public group messages" aria-live="polite">
          {visiblePosts.length === 0 && <div className="public-chat-welcome"><span>DRACARYS COMMUNITY</span><strong>Welcome to the room.</strong><p>Introduce yourself, share what you’re watching, or ask a question. Signals and setups have their own format, but everyone talks in the same conversation.</p></div>}
          {!ready ? <div className="public-chat-empty">Opening the room…</div> : visiblePosts.map((post, index) => <div key={post.id}>
            {(index === 0 || new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(visiblePosts[index - 1].createdAt)) !== new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(post.createdAt))) && <div className="public-chat-date"><span>{new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kampala" }).format(new Date(post.createdAt))}</span></div>}
            <article className={`group-message ${post.mine ? "group-message-own" : ""}`}>
              {!post.mine && <span className="group-message-avatar">{initials(post.author)}</span>}
              <div className="group-message-content"><div className="group-message-byline">{post.mine ? <strong>You</strong> : <strong>{post.author}</strong>}<time>{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala" }).format(new Date(post.createdAt))}</time>{post.kind !== "chat" && <span className={`group-message-kind group-message-kind-${post.kind}`}>{post.kind === "signal" ? "SIGNAL" : post.kind === "setup" ? "TRADE SETUP" : "FILE"}</span>}{post.mine && <button type="button" onClick={() => remove(post.id)}>Delete</button>}</div>
                <div className="group-message-bubble">
                  {post.instrument && <div className="group-market-view"><strong>{post.instrument}</strong><span className={post.direction === "SELL" ? "group-market-sell" : "group-market-buy"}>{post.direction}</span>{post.sampleResult && <small>{post.sampleResult}</small>}</div>}
                  {post.body && <p>{post.body}</p>}
                  {(post.entry || post.invalidation || post.target) && <div className="group-setup-details"><div><small>ENTRY</small><strong>{post.entry || "—"}</strong></div><div><small>INVALIDATION</small><strong>{post.invalidation || "—"}</strong></div><div><small>TARGET IDEA</small><strong>{post.target || "—"}</strong></div></div>}
                  {post.chartVariant && <DemoChartImage variant={post.chartVariant} caption="SAMPLE CHART · NOT LIVE MARKET DATA" />}
                  {post.attachment && <div className="group-shared-file">{post.attachment.type.startsWith("image/") && <a href={post.attachment.dataUrl} target="_blank" rel="noreferrer" className="group-image-link"><Image src={post.attachment.dataUrl} alt={post.attachment.name} width={900} height={650} unoptimized /></a>}<a className="group-file-link" href={post.attachment.dataUrl} download={post.attachment.name}><span aria-hidden="true">{post.attachment.type.startsWith("image/") ? "▧" : "FILE"}</span><span><strong>{post.attachment.name}</strong><small>{post.attachment.type} · {formatSize(post.attachment.size)}</small></span><b>DOWNLOAD</b></a></div>}
                  <div className="group-message-footer"><div className="group-reactions">{reactions.map((reaction) => {
                    const oldKey = reaction.key === "like" ? "useful" : reaction.key === "think" ? "question" : reaction.key;
                    const count = reaction.key === "like" ? post.useful : reaction.key === "think" ? post.questions : post.reactionCounts?.[reaction.key] ?? 0;
                    const active = post.myReactions.includes(reaction.key) || post.myReactions.includes(oldKey);
                    return <button type="button" key={reaction.key} disabled={readOnly} className={active ? "group-reaction-active" : ""} onClick={() => react(post.id, reaction.key)} aria-label={`${reaction.label}, ${count}`}>{reaction.icon}{count > 0 && <span>{count}</span>}</button>;
                  })}</div><button className="group-reply-action" type="button" onClick={() => setOpenReply(openReply === post.id ? null : post.id)}>{post.replies.length ? `${post.replies.length} replies` : "Reply"}</button></div>
                  {post.replies.length > 0 && <div className="group-demo-replies">{post.replies.map((reply) => <div key={reply.id}><strong>{reply.author}</strong><span>{reply.body}</span></div>)}</div>}
                  {openReply === post.id && !readOnly && <form className="group-demo-reply-form" onSubmit={(event) => { event.preventDefault(); addReply(post.id, event.currentTarget); }}><label className="sr-only" htmlFor={`room-reply-${post.id}`}>Write a reply</label><input id={`room-reply-${post.id}`} name="reply" maxLength={2000} required placeholder="Write a reply…" /><button type="submit" aria-label="Send reply">Send</button></form>}
                </div>
              </div>
              {post.mine && <span className="group-message-avatar group-message-avatar-own">{initials(name)}</span>}
            </article>
          </div>)}
          {ready && visiblePosts.length === 0 && search && <div className="public-chat-empty">No messages match that search.</div>}
        </div>

        {readOnly ? <div className="public-chat-join"><p>Join as Founder Trader Demo to try the composer here.</p><a className="button button-outline button-small" href="/sign-in">Choose demo account</a></div> : <form className="public-chat-composer" onSubmit={publish}>
          {(kind === "signal" || kind === "setup") && <div className="public-chat-trade-fields"><label>Market<select name="instrument" defaultValue="XAUUSD"><option>XAUUSD</option><option>EURUSD</option><option>GBPUSD</option><option>BTCUSD</option><option>US500</option></select></label><label>Side<select name="direction" defaultValue="BUY"><option>BUY</option><option>SELL</option></select></label><label>Entry<input name="entry" maxLength={80} placeholder="Optional" /></label><label>Invalidation<input name="invalidation" maxLength={100} placeholder="What changes your view?" /></label><label>Target<input name="target" maxLength={80} placeholder="Optional" /></label></div>}
          <div className="public-chat-compose-row"><ProfileAvatar name={profileName} avatarKey={avatarKey} size="small" /><label className="sr-only" htmlFor="room-post-body">Write a message to the community</label><textarea id="room-post-body" name="body" maxLength={8000} required={kind !== "file"} placeholder={kind === "chat" ? "Message the group…  (Enter to send)" : kind === "signal" ? "Share the scenario and what invalidates it…" : kind === "setup" ? "Add the context behind the setup…" : "Add a note about the file…"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <label className="public-chat-attach" title="Attach an image or file"><input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,.png,.jpg,.jpeg,.webp,.pdf,.txt,.csv" onChange={(event) => setPickedFile(event.target.files?.[0] ?? null)} /><span aria-hidden="true">+</span><span className="sr-only">Attach image or file</span></label><button className="public-chat-send" type="submit" disabled={!ready || (kind === "file" && !pickedFile)} aria-label="Send message">Send</button></div>
          <div className="public-chat-compose-bottom"><div className="public-chat-compose-modes" aria-label="Message type">{messageModes.map((item) => <button key={item.value} type="button" className={kind === item.value ? "public-chat-mode-active" : ""} onClick={() => { setKind(item.value); setNotice(""); }}><TypeIcon kind={item.value} />{item.label}</button>)}</div><span className="public-chat-file-note">{pickedFile ? `${pickedFile.name} · ${formatSize(pickedFile.size)}` : "Images and files up to 1 MB"}{notice && <span role="status"> · {notice}</span>}</span></div>
        </form>}
      </div>
    </section>
  );
}
