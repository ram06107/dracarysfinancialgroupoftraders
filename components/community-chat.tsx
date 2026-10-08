"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { editCommunityMessage, removeCommunityMessage, sendCommunityMessage, toggleCommunityReaction } from "@/app/actions/community-chat";
import { BrandMark } from "@/components/brand-mark";
import { ProfileAvatar } from "@/components/profile-avatar";
import { RailIcon } from "@/components/rail-icon";
import { VerifiedTraderBadge } from "@/components/verified-trader-badge";
import type { CommunityChatMessage, GroupReaction } from "@/lib/community/chat";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const reactionOptions: { key: GroupReaction; emoji: string; label: string }[] = [
  { key: "like", emoji: "👍", label: "Like" }, { key: "love", emoji: "❤️", label: "Love" },
  { key: "fire", emoji: "🔥", label: "Fire" }, { key: "think", emoji: "🤔", label: "Thinking" }, { key: "eyes", emoji: "👀", label: "Eyes" },
];
const messageKinds = [
  { key: "chat", label: "Message" }, { key: "signal", label: "Signal" },
  { key: "setup", label: "Setup" }, { key: "file", label: "File" },
] as const;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "M";
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala" }).format(new Date(value));
}

function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Kampala" }).format(new Date(value));
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kampala" }).format(new Date(value));
}

function MessageBubble({ message, own, signedIn, onReply }: { message: CommunityChatMessage; own: boolean; signedIn: boolean; onReply: (message: CommunityChatMessage) => void }) {
  const [editing, setEditing] = useState(false);
  const kindLabel = message.message_kind === "signal" ? "SIGNAL" : message.message_kind === "setup" ? "TRADE SETUP" : message.message_kind === "file" ? "FILE" : "";

  return <article className={`group-message ${own ? "group-message-own" : ""}`}>
    {!own && <Link className="group-message-avatar" href={`/members/${message.author_id}`} aria-label={`${message.author}'s profile`}>{initials(message.author)}</Link>}
    <div className="group-message-content">
      <div className="group-message-byline">{own ? <strong>You</strong> : <><Link href={`/members/${message.author_id}`}>{message.author}</Link>{message.is_verified_trader && <VerifiedTraderBadge compact />}</>}<time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>{message.edited_at && <span>edited</span>}{kindLabel && <span className={`group-message-kind group-message-kind-${message.message_kind}`}>{kindLabel}</span>}</div>
      <div className="group-message-bubble">
        {message.reply_to && <div className="group-reply-quote"><strong>{message.reply_to.author}</strong><span>{message.reply_to.body}</span></div>}
        {message.instrument && <div className="group-market-view"><strong>{message.instrument}</strong><span className={message.direction === "SELL" ? "group-market-sell" : "group-market-buy"}>{message.direction}</span></div>}
        {message.body && (editing ? <form action={editCommunityMessage} className="group-edit-form"><input type="hidden" name="message_id" value={message.id} /><textarea name="body" defaultValue={message.body} maxLength={8000} required /><div><button type="button" onClick={() => setEditing(false)}>Cancel</button><button type="submit">Save edit</button></div></form> : <p>{message.body}</p>)}
        {(message.entry_zone || message.invalidation || message.target_idea) && <div className="group-setup-details"><div><small>ENTRY</small><strong>{message.entry_zone || "—"}</strong></div><div><small>INVALIDATION</small><strong>{message.invalidation || "—"}</strong></div><div><small>TARGET IDEA</small><strong>{message.target_idea || "—"}</strong></div></div>}
        {message.attachment && <div className="group-shared-file">
          {message.attachment.mime.startsWith("image/") && <a href={message.attachment.url} target="_blank" rel="noreferrer" className="group-image-link"><Image src={message.attachment.url} alt={message.attachment.name} width={900} height={650} unoptimized /></a>}
          <a href={message.attachment.url} target="_blank" rel="noreferrer" className="group-file-link" download={message.attachment.name}><span aria-hidden="true">{message.attachment.mime.startsWith("image/") ? "▧" : "FILE"}</span><span><strong>{message.attachment.name}</strong><small>{message.attachment.mime} · {message.attachment.size ? `${Math.ceil(message.attachment.size / 1024)} KB` : "Shared file"}</small></span><b>OPEN</b></a>
        </div>}
        <div className="group-message-footer">
          <div className="group-reactions">{reactionOptions.map((reaction) => <form action={toggleCommunityReaction} key={reaction.key}><input type="hidden" name="message_id" value={message.id} /><input type="hidden" name="reaction" value={reaction.key} /><button type="submit" className={message.my_reactions.includes(reaction.key) ? "group-reaction-active" : ""} disabled={!signedIn} aria-label={`${reaction.label}: ${message.reactions[reaction.key]}`} title={reaction.label}>{reaction.emoji}{message.reactions[reaction.key] > 0 && <span>{message.reactions[reaction.key]}</span>}</button></form>)}</div>
          {signedIn && <button className="group-reply-action" type="button" onClick={() => onReply(message)}>Reply</button>}
          {own && signedIn && !editing && <div className="group-message-owner-actions"><button type="button" onClick={() => setEditing(true)}>Edit</button><form action={removeCommunityMessage}><input type="hidden" name="message_id" value={message.id} /><button type="submit">Delete</button></form></div>}
        </div>
      </div>
    </div>
    {own && <span className="group-message-avatar group-message-avatar-own" aria-hidden="true">{initials(message.author)}</span>}
  </article>;
}

export function CommunityChat({ messages, signedIn, name, avatarKey, avatarUrl, memberId, roomId, failed = false }: { messages: CommunityChatMessage[]; signedIn: boolean; name: string; avatarKey?: string | null; avatarUrl?: string; memberId: string | null; roomId: string | null; failed?: boolean }) {
  const router = useRouter();
  const timeline = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<(typeof messageKinds)[number]["key"]>("chat");
  const [replyTarget, setReplyTarget] = useState<CommunityChatMessage | null>(null);
  const [fileName, setFileName] = useState("");
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const filtered = useMemo(() => messages.filter((message) => `${message.author} ${message.body} ${message.instrument ?? ""} ${message.attachment?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [messages, search]);
  const chronological = [...filtered].reverse();

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let client: ReturnType<typeof createBrowserSupabaseClient>;
    try { client = createBrowserSupabaseClient(); }
    catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Show that realtime could not connect.
      setConnection("offline");
      return;
    }
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { if (!disposed) router.refresh(); }, 220);
    };
    const channel = client.channel("dracarys-public-community")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reaction_counts" }, scheduleRefresh)
      .subscribe((status) => {
        if (!disposed) setConnection(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "offline" : "connecting");
      });
    return () => { disposed = true; if (refreshTimer) clearTimeout(refreshTimer); void client.removeChannel(channel); };
  }, [router]);

  useEffect(() => {
    if (!search) timeline.current?.scrollTo({ top: timeline.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, search]);

  function replyTo(message: CommunityChatMessage) {
    setReplyTarget(message);
    setKind("chat");
    document.getElementById("group-chat-input")?.focus();
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return <section className="public-chat-shell" aria-label="The DRACARYS public group chat">
    <nav className="chat-app-rail" aria-label="DRACARYS pages">
      <Link className="chat-rail-brand" href="/" aria-label="DRACARYS home"><BrandMark small /></Link>
      <Link className="chat-rail-link chat-rail-current" href="/community" aria-current="page"><RailIcon name="chats" /><span>Chats</span></Link>
      <Link className="chat-rail-link" href="/feed"><RailIcon name="feed" /><span>Feed</span></Link>
      <Link className="chat-rail-link" href="/traders"><RailIcon name="traders" /><span>Traders</span></Link>
      <Link className="chat-rail-link" href="/record"><RailIcon name="record" /><span>Record</span></Link>
      <Link className="chat-rail-link" href="/analytics"><RailIcon name="analytics" /><span>Analytics</span></Link>
      <div className="chat-rail-bottom">{signedIn ? <Link className="chat-rail-link" href="/profile"><RailIcon name="profile" /><span>Profile</span></Link> : <><Link className="chat-rail-link" href="/sign-in"><RailIcon name="sign-in" /><span>Log in</span></Link><Link className="chat-rail-link" href="/sign-up"><RailIcon name="sign-up" /><span>Join</span></Link></>}</div>
    </nav>
    <aside className="public-chat-sidebar">
      <div className="public-chat-sidebar-head"><h1>Chats</h1><span>DRACARYS</span></div>
      <label className="public-chat-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search group messages</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" /></label>
      <div className="public-chat-list-label">PUBLIC GROUP <span>1 chat</span></div>
      <div className="public-chat-room-active" aria-current="page"><span className="public-chat-room-icon"><BrandMark small /></span><div><strong>DRACARYS Community</strong><small>{messages[0]?.body || "The shared public room"}</small></div><span className="public-chat-room-time">{messages[0] ? timeLabel(messages[0].created_at) : ""}</span></div>
      <div className="public-chat-member"><ProfileAvatar name={signedIn ? name : "Guest"} avatarKey={avatarKey} avatarUrl={avatarUrl} size="small" /><div><strong>{signedIn ? name : "Guest"}</strong><small>{signedIn ? "Account" : "Public visitor"}</small></div></div>
    </aside>

    <div className="public-chat-main">
      <header className="public-chat-header"><span className="public-chat-room-icon"><BrandMark small /></span><div><h2>The DRACARYS Community</h2><p>Public group chat <span>·</span> One shared room</p></div><span className={`public-chat-status ${connection === "offline" || failed ? "public-chat-status-offline" : ""}`}><i />{failed ? "SETUP REQUIRED" : connection === "live" ? "LIVE" : connection === "offline" ? "RECONNECTING" : "CONNECTING"}</span></header>
      {failed && <div className="public-chat-error" role="status">The group chat could not connect. Refresh the page, and contact the team if the problem continues.</div>}
      <div className="public-chat-scroll" ref={timeline} role="log" aria-label="Public group messages" aria-live="polite">
        {messages.length === 0 && !search && <div className="public-chat-welcome"><span>DRACARYS COMMUNITY</span><strong>Welcome to the room.</strong><p>Introduce yourself, share what you’re watching, or ask a question. Signals and setups have their own format, but everyone talks in the same conversation.</p></div>}
        {chronological.map((message, index) => <div key={message.id}>{(index === 0 || dayKey(chronological[index - 1].created_at) !== dayKey(message.created_at)) && <div className="public-chat-date"><span>{dayLabel(message.created_at)}</span></div>}<MessageBubble message={message} own={message.author_id === memberId} signedIn={signedIn} onReply={replyTo} /></div>)}
        {chronological.length === 0 && (search || messages.length > 0) && <div className="public-chat-empty">{search ? "No messages match that search." : "No messages in this room yet."}</div>}
      </div>
      {signedIn && roomId && !failed ? <form className="public-chat-composer" action={sendCommunityMessage}>
        <input type="hidden" name="room_id" value={roomId} /><input type="hidden" name="message_kind" value={kind} /><input type="hidden" name="reply_to_message_id" value={replyTarget?.id ?? ""} />
        {replyTarget && <div className="public-chat-replying"><span><strong>Replying to {replyTarget.author}</strong><small>{replyTarget.body}</small></span><button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">×</button></div>}
        {(kind === "signal" || kind === "setup") && <div className="public-chat-trade-fields"><label>Market<select name="instrument" defaultValue="XAUUSD"><option>XAUUSD</option><option>EURUSD</option><option>GBPUSD</option><option>BTCUSD</option><option>US500</option></select></label><label>Side<select name="direction" defaultValue="BUY"><option>BUY</option><option>SELL</option></select></label><label>Entry<input name="entry_zone" maxLength={80} placeholder="Optional" /></label><label>Invalidation<input name="invalidation" maxLength={100} placeholder="What changes your view?" /></label><label>Target<input name="target_idea" maxLength={80} placeholder="Optional" /></label></div>}
        <div className="public-chat-compose-row"><ProfileAvatar name={name} avatarKey={avatarKey} avatarUrl={avatarUrl} size="small" /><label className="sr-only" htmlFor="group-chat-input">Write a message to the community</label><textarea id="group-chat-input" name="body" rows={2} maxLength={8000} required={kind !== "file"} placeholder={kind === "chat" ? "Message the group…  (Enter to send)" : kind === "signal" ? "Share the scenario and what invalidates it…" : kind === "setup" ? "Add your setup and the context behind it…" : "Add a note about the shared file…"} onKeyDown={handleComposerKey} />
          <label className="public-chat-attach" title="Attach an image or file"><input name="attachment" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,.png,.jpg,.jpeg,.webp,.pdf,.txt,.csv" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} /><span aria-hidden="true">+</span><span className="sr-only">Attach image or file</span></label><button className="public-chat-send" type="submit" aria-label="Send message">Send</button></div>
        <div className="public-chat-compose-bottom"><div className="public-chat-compose-modes" aria-label="Message type">{messageKinds.map((item) => <button key={item.key} type="button" className={kind === item.key ? "public-chat-mode-active" : ""} onClick={() => setKind(item.key)}>{item.label}</button>)}</div><span className="public-chat-file-note">{fileName ? `Attached: ${fileName}` : "Images and files up to 10 MB"}</span></div>
      </form> : failed && signedIn ? <div className="public-chat-join"><p>The public room could not load. Refresh after the room setup is complete.</p></div> : <div className="public-chat-join"><p>Join the community to send messages, share files and react.</p><Link href="/sign-in">Log in</Link><Link className="button button-dark button-small" href="/sign-up">Join free</Link></div>}
    </div>
  </section>;
}
