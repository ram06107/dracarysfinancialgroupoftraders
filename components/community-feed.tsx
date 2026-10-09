"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addComment, deleteCommunityPost, publishPost, toggleReaction } from "@/app/actions/community";
import { MemberAvatar } from "@/components/member-avatar";
import type { CommunityPost } from "@/lib/community/feed";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { VerifiedTraderBadge } from "@/components/verified-trader-badge";

const kinds = [
  { value: "chat", label: "Chat" },
  { value: "signal", label: "Signal" },
  { value: "setup", label: "Setup" },
  { value: "file", label: "File" },
] as const;

function stamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Kampala",
  }).format(new Date(value)) + " EAT";
}

function Initial({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return <MemberAvatar name={name} src={avatarUrl} />;
}

export function PostComposer({ signedIn, canPublish = false, name, demoMember = false, kind, onKindChange, returnTo = "/community" }: { signedIn: boolean; canPublish?: boolean; name: string; demoMember?: boolean; kind: (typeof kinds)[number]["value"]; onKindChange: (kind: (typeof kinds)[number]["value"]) => void; returnTo?: "/community" | "/feed" }) {
  if (demoMember) {
    return (
      <section className="demo-member-panel" aria-label="Read-only demo member session">
        <Initial name={name || "Demo Member"} />
        <div className="demo-member-copy">
          <div><strong>Demo member session</strong><span className="demo-tag">READ ONLY</span></div>
          <p>You can look around as a member. Posting, replies and reactions are disabled in this preview.</p>
        </div>
      </section>
    );
  }

  if (!signedIn) {
    return (
      <section className="join-composer">
        <div className="composer-mark"><span>D</span></div>
        <div className="composer-copy">
          <strong>Have something to add?</strong>
          <p>Membership is free. Join the conversation with traders who share their reasoning.</p>
          <div className="composer-links"><Link className="button button-dark button-small" href="/sign-up">Join the community</Link><Link href="/sign-in">Already a member? Log in</Link></div>
        </div>
      </section>
    );
  }

  if (!canPublish) {
    return <section className="social-compose-locked"><span>Feed publishing is for approved DRACARYS Financial Traders.</span><p>As a Public Member, you can comment on feed posts and share freely in the Community group chat.</p><Link href="/profile/trader-application">Apply for trader review</Link></section>;
  }

  return (
    <form className="post-composer post-composer-rich" action={publishPost}>
      <Initial name={name || "Member"} />
      <div className="composer-field">
        <input type="hidden" name="return_to" value={returnTo} />
        <div className="live-kind-tabs" role="tablist" aria-label="Choose a community post type">
          {kinds.map((item) => <button key={item.value} type="button" role="tab" aria-selected={kind === item.value} className={kind === item.value ? "live-kind-active" : ""} onClick={() => onKindChange(item.value)}>{item.label}</button>)}
        </div>
        <input type="hidden" name="post_kind" value={kind} />
        <label className="sr-only" htmlFor="post-body">Write a community post</label>
        <textarea id="post-body" name="body" maxLength={12000} required={kind !== "file"} placeholder={kind === "chat" ? "Share an observation, ask a question or post your analysis…" : kind === "signal" ? "Describe the scenario, your reasoning and what would change your view…" : kind === "setup" ? "Add the context behind this setup. Keep the invalidation clear…" : "Add a note about the file (optional)…"} />
        {(kind === "signal" || kind === "setup") && <div className="live-idea-fields">
          <label>Market<select name="instrument" defaultValue="XAUUSD"><option>XAUUSD</option><option>EURUSD</option><option>GBPUSD</option><option>BTCUSD</option><option>US500</option></select></label>
          <label>View<select name="direction" defaultValue="BUY"><option>BUY</option><option>SELL</option></select></label>
          <label>Entry area<input name="entry_zone" maxLength={80} placeholder="Optional" /></label>
          <label>Invalidation<input name="invalidation" maxLength={100} placeholder="What changes your view?" /></label>
          <label>Target idea<input name="target_idea" maxLength={80} placeholder="Optional" /></label>
        </div>}
        <div className="live-attachment-line">
          <label className="live-file-label"><input type="file" name="attachment" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,.png,.jpg,.jpeg,.webp,.pdf,.txt,.csv" />Attach a file</label>
          <span>Images, PDF, text or CSV · up to 10 MB</span>
          <small>Shared files are public with the post. Don’t attach account or client information.</small>
        </div>
        {(kind === "signal" || kind === "setup") && <p className="live-risk-note">Ideas are members’ opinions, not a recommendation. Protect your own account and make your own decisions.</p>}
        <div className="composer-bottom"><span>Give people the context, and keep the follow-up in the thread.</span><button className="button button-dark button-small" type="submit">{kind === "chat" ? "Publish post" : kind === "signal" ? "Share signal" : kind === "setup" ? "Share setup" : "Share file"}</button></div>
      </div>
    </form>
  );
}

function DeletePostButton({ postId, returnTo }: { postId: string; returnTo: "/community" | "/feed" }) {
  return <form action={deleteCommunityPost} className="post-delete-form">
    <input type="hidden" name="post_id" value={postId} />
    <input type="hidden" name="return_to" value={returnTo} />
    <button className="post-delete-button" type="submit" onClick={(event) => {
      if (!window.confirm("Remove this post from the feed?")) event.preventDefault();
    }}>Delete post</button>
  </form>;
}

export function CommunityPostCard({ post, signedIn, memberId, returnTo = "/community" }: { post: CommunityPost; signedIn: boolean; memberId?: string | null; returnTo?: "/community" | "/feed" }) {
  const kindLabel = post.post_kind === "signal" ? "SIGNAL SCENARIO" : post.post_kind === "setup" ? "TRADE SETUP" : post.post_kind === "file" ? "SHARED FILE" : "CHAT";
  const compact = returnTo === "/feed";
  const [expanded, setExpanded] = useState(!compact);
  const preview = post.body.replace(/\s+/g, " ").trim();
  const ownsPost = signedIn && Boolean(memberId) && post.author_id === memberId;
  return (
    <article className={`post-card ${compact ? "feed-post-card" : ""}`}>
      <div className="post-heading">
        <Initial name={post.author} avatarUrl={post.author_avatar_url} />
        <div className="post-byline"><div className="post-author-name"><Link className="profile-name-link" href={`/members/${post.author_id}`}><strong>{post.author}</strong></Link>{post.is_verified_trader && <VerifiedTraderBadge compact />}</div><span>{stamp(post.created_at)}</span></div>
        <div className="post-heading-tools"><span className={`post-kind post-kind-${post.post_kind}`}>{kindLabel}</span>{ownsPost && <DeletePostButton postId={post.id} returnTo={returnTo} />}</div>
      </div>
      {compact && !expanded ? <div className="feed-post-preview">
        {post.instrument && <span className="feed-post-market">{post.instrument} {post.direction ?? ""}</span>}
        <p>{preview.length > 220 ? `${preview.slice(0, 220).trimEnd()}…` : preview}</p>
        {post.attachment && <small>Attachment · {post.attachment.name}</small>}
        <button type="button" onClick={() => setExpanded(true)}>Open post</button>
      </div> : <>
      {post.instrument && <div className="live-post-instrument"><strong>{post.instrument}</strong><span className={post.direction === "SELL" ? "live-post-sell" : "live-post-buy"}>{post.direction}</span><small>SCENARIO · NOT LIVE DATA</small></div>}
      <p className="post-body">{post.body}</p>
      {(post.entry_zone || post.invalidation || post.target_idea) && <div className="live-post-levels"><div><span>ENTRY AREA</span><strong>{post.entry_zone || "Not set"}</strong></div><div><span>INVALIDATION</span><strong>{post.invalidation || "Not set"}</strong></div><div><span>TARGET IDEA</span><strong>{post.target_idea || "Not set"}</strong></div></div>}
      {post.attachment && <div className="live-post-attachment-wrap">{post.attachment.mime.startsWith("image/") && <a className="live-post-image-link" href={post.attachment.url} target="_blank" rel="noreferrer"><Image className="live-post-image" src={post.attachment.url} alt={post.attachment.name} width={1200} height={900} unoptimized /></a>}<a className="live-post-attachment" href={post.attachment.url} target="_blank" rel="noreferrer"><span aria-hidden="true">FILE</span><span><strong>{post.attachment.name}</strong><small>{post.attachment.mime} · {post.attachment.size ? `${Math.ceil(post.attachment.size / 1024)} KB` : "Shared file"}</small></span><b>OPEN</b></a></div>}
      <div className="post-actions">
        {(["like", "insightful", "question"] as const).map((reaction) => (
          <form action={toggleReaction} key={reaction}>
            <input type="hidden" name="post_id" value={post.id} />
            <input type="hidden" name="reaction" value={reaction} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button
              className={`reaction-button ${post.myReactions.includes(reaction) ? "reaction-active" : ""}`}
              type="submit"
              aria-label={`${reaction}${post.reactions[reaction] === null ? "" : `, ${post.reactions[reaction]} reactions`}`}
              title={signedIn ? reaction : "Sign in to react"}
              disabled={!signedIn}
            >
              <span aria-hidden="true">{reaction === "like" ? "＋" : reaction === "insightful" ? "◇" : "?"}</span>
              <span>{reaction === "like" ? "Useful" : reaction === "insightful" ? "Insightful" : "Question"}</span>
              {post.reactions[reaction] !== null && <b>{post.reactions[reaction]}</b>}
            </button>
          </form>
        ))}
        <span className="comment-count">{post.comments.length} {post.comments.length === 1 ? "reply" : "replies"}</span>
      </div>
      {post.comments.length > 0 && (
        <div className="comment-list">
          {post.comments.slice(-3).map((comment) => (
            <div className="comment" key={comment.id}>
              <Initial name={comment.author} />
              <div><div className="post-author-name"><Link className="profile-name-link" href={`/members/${comment.author_id}`}><strong>{comment.author}</strong></Link>{comment.is_verified_trader && <VerifiedTraderBadge compact />}</div><p>{comment.body}</p><time>{stamp(comment.created_at)}</time></div>
            </div>
          ))}
          {post.comments.length > 3 && <p className="older-replies">Showing the latest 3 replies</p>}
        </div>
      )}
      {signedIn ? (
        <form className="reply-form" action={addComment}>
          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <label className="sr-only" htmlFor={`reply-${post.id}`}>Write a reply</label>
          <input id={`reply-${post.id}`} name="body" maxLength={6000} required placeholder="Add a thoughtful reply…" />
          <button type="submit" aria-label="Send reply">Send</button>
        </form>
      ) : (
        <p className="reply-sign-in"><Link href="/sign-in">Log in</Link> to reply</p>
      )}
      {compact && <button className="feed-post-close" type="button" onClick={() => setExpanded(false)}>Close post</button>}
      </>}
    </article>
  );
}

export function CommunityFeedList({ posts, signedIn, name, memberId, demoMember = false, live = false }: { posts: CommunityPost[]; signedIn: boolean; name: string; memberId?: string | null; demoMember?: boolean; live?: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<"all" | (typeof kinds)[number]["value"]>("all");
  const [composeKind, setComposeKind] = useState<(typeof kinds)[number]["value"]>("chat");
  const [search, setSearch] = useState("");
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  useEffect(() => {
    if (!live) return;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let client: ReturnType<typeof createBrowserSupabaseClient>;
    try {
      client = createBrowserSupabaseClient();
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Show that realtime could not connect.
      setConnection("offline");
      return;
    }
    const channel = client
      .channel("dracarys-community-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => { if (!disposed) router.refresh(); }, 250);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => { if (!disposed) router.refresh(); }, 250);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => { if (!disposed) router.refresh(); }, 250);
      })
      .subscribe((status) => {
        if (!disposed) setConnection(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "offline" : "connecting");
      });
    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      void client.removeChannel(channel);
    };
  }, [live, router]);
  const filtered = useMemo(() => posts.filter((post) => {
    const kindMatch = kind === "all" || post.post_kind === kind;
    const haystack = `${post.author} ${post.body} ${post.instrument ?? ""} ${post.attachment?.name ?? ""}`.toLowerCase();
    return kindMatch && haystack.includes(search.trim().toLowerCase());
  }), [kind, posts, search]);
  const categories: { value: "all" | (typeof kinds)[number]["value"]; label: string; icon: string }[] = [{ value: "all", label: "All activity", icon: "ALL" }, { ...kinds[0], label: "General", icon: "CHAT" }, { ...kinds[1], label: "Signals", icon: "SIGNAL" }, { ...kinds[2], label: "Trade setups", icon: "SETUP" }, { ...kinds[3], label: "Shared files", icon: "FILE" }];
  const selected = categories.find((item) => item.value === kind) ?? categories[0];

  return <section className="messenger-shell messenger-connected" aria-label="Community chat">
    <aside className="messenger-rooms">
      <div className="messenger-brand"><span className="messenger-brand-mark">D</span><div><strong>DRACARYS</strong><small>COMMUNITY</small></div><span className="messenger-room-stamp">ROOM</span></div>
      <label className="messenger-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search messages and channels</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" /></label>
      <div className="messenger-room-label">ROOMS <span>{posts.length}</span></div>
      <nav className="messenger-room-list" aria-label="Community rooms">{categories.map((item) => { const count = item.value === "all" ? posts.length : posts.filter((post) => post.post_kind === item.value).length; const latest = posts.filter((post) => item.value === "all" || post.post_kind === item.value)[0]; return <button type="button" key={item.value} className={kind === item.value ? "messenger-room-active" : ""} aria-pressed={kind === item.value} onClick={() => { setKind(item.value); if (item.value !== "all") setComposeKind(item.value); }}><span className={`messenger-room-icon messenger-icon-${item.value}`}>{item.icon}</span><span className="messenger-room-copy"><strong>{item.label}</strong><small>{latest?.body || "Start the conversation"}</small></span><span className="messenger-room-meta">{count || ""}</span></button>; })}</nav>
      <div className="messenger-sidebar-foot"><span className="messenger-presence" />{signedIn ? name : "Public room"}<small>{signedIn ? "Member account" : "Join to take part"}</small></div>
    </aside>
    <div className="messenger-conversation">
      <header className="messenger-chat-head"><span className={`messenger-room-icon messenger-icon-${kind}`}>{selected.icon}</span><div><h2>{selected.label}</h2><p>{kind === "all" ? "All room conversations" : "Community discussion and shared ideas"} · {filtered.length} messages</p></div><span className={`messenger-online ${connection === "offline" ? "messenger-offline" : ""}`}><i /> {connection === "live" ? "LIVE" : connection === "offline" ? "RECONNECTING" : "CONNECTING"}</span></header>
      <div className="messenger-timeline messenger-connected-timeline" role="log" aria-label={`${selected.label} messages`}>
        {filtered.length === 0 ? <div className="messenger-empty"><strong>This room is quiet.</strong><span>The first conversation is waiting to happen.</span></div> : [...filtered].reverse().map((post) => <div className="messenger-message-row" key={post.id}><Initial name={post.author} /><CommunityPostCard post={post} signedIn={signedIn} memberId={memberId} /></div>)}
      </div>
      <PostComposer signedIn={signedIn} name={name} demoMember={demoMember} kind={composeKind} onKindChange={(next) => { setComposeKind(next); setKind(next); }} />
    </div>
  </section>;
}
