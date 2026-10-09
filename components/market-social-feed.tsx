"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { publishPost } from "@/app/actions/community";
import { CommunityPostCard } from "@/components/community-feed";
import { DemoChartImage } from "@/components/demo-chart-image";
import { AttachmentIcon } from "@/components/attachment-icon";
import { MemberAvatar } from "@/components/member-avatar";
import { demoMarketPosts } from "@/lib/market-feed-data";
import type { CommunityPost } from "@/lib/community/feed";

type DemoReply = { id: string; author: string; body: string; createdAt: string };
type DemoPost = {
  id: string; topic: string; label: string; market: string; title: string; author: string;
  createdAt: string; body: string; note: string; chartVariant?: "range" | "rejection" | "breakout" | "unresolved" | "desk";
  attachment?: { name: string; mime: string; dataUrl: string; size: number };
  likes: number; liked: boolean; replies: DemoReply[]; mine?: boolean;
};

const STORAGE_KEY = "dracarys_social_feed_v1";
const MAX_LOCAL_FILE_BYTES = 1_000_000;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/csv"]);

function seedPosts(): DemoPost[] {
  return demoMarketPosts.map((post, index) => ({
    id: post.id, topic: post.topic, label: post.label, market: post.market, title: post.title, author: post.author,
    createdAt: new Date(Date.now() - index * 45 * 60_000).toISOString(), body: post.excerpt, note: post.note,
    chartVariant: post.chartVariant, likes: [18, 11, 8, 23, 16][index] ?? 0, liked: false,
    replies: index < 3 ? [{ id: `${post.id}-comment`, author: ["Demo trader 02", "Demo member", "Demo trader 01"][index], body: ["I’m watching the same level. The close will tell me more than the first push.", "It helps to leave room for an unresolved outcome when the week is not finished.", "That distinction keeps a setup outcome separate from whether someone took the trade."][index], createdAt: new Date(Date.now() - 22 * 60_000).toISOString() }] : [],
  }));
}

function formatStamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala" }).format(new Date(value));
}

function fileData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the selected file."));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function DemoSocialFeed({ name, readOnly, profileStorageKey }: { name: string; readOnly: boolean; profileStorageKey?: string }) {
  const [posts, setPosts] = useState<DemoPost[]>([]);
  const [ready, setReady] = useState(false);
  const [profileName, setProfileName] = useState(name);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [expandedPostIds, setExpandedPostIds] = useState<string[]>([]);

  useEffect(() => {
    const samples = seedPosts();
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore locally saved demo posts after hydration.
      setPosts(Array.isArray(saved) ? saved as DemoPost[] : samples);
      if (!Array.isArray(saved)) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
    } catch { setPosts(samples); }
    if (profileStorageKey) {
      try {
        const savedProfile: unknown = JSON.parse(window.localStorage.getItem(profileStorageKey) ?? "null");
        if (savedProfile && typeof savedProfile === "object") {
          const profile = savedProfile as { public_name?: unknown; avatar_key?: unknown };
          if (typeof profile.public_name === "string" && profile.public_name.trim()) setProfileName(profile.public_name.trim());
          if (typeof profile.avatar_key === "string") {
            if (profile.avatar_key.startsWith("data:image/")) setProfileAvatar(profile.avatar_key);
            else if (profile.avatar_key === "dragon") setProfileAvatar("/dracarys-mark.png");
          }
        }
      } catch { /* Keep the initials when no local profile is saved. */ }
    }
    setReady(true);
  }, [profileStorageKey]);

  function persist(next: DemoPost[], message: string) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setPosts(next);
      setNotice(message);
      return true;
    } catch {
      setNotice("This browser could not save the change. Try a smaller attachment or remove older local posts.");
      return false;
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const text = body.trim();
    if (!text && !pickedFile) { setNotice("Write a note or attach a file first."); return; }
    if (pickedFile && (pickedFile.size > MAX_LOCAL_FILE_BYTES || !allowedTypes.has(pickedFile.type))) { setNotice("Choose a PNG, JPG, WEBP, PDF, text or CSV file up to 1 MB."); return; }
    let attachment: DemoPost["attachment"];
    if (pickedFile) {
      try { attachment = { name: pickedFile.name, mime: pickedFile.type, size: pickedFile.size, dataUrl: await fileData(pickedFile) }; }
      catch { setNotice("That file could not be read. Choose it again and retry."); return; }
    }
    const nextPost: DemoPost = {
      id: crypto.randomUUID(), topic: "market-life", label: "Market note", market: "DESK NOTES", title: "",
      author: profileName, createdAt: new Date().toISOString(), body: text || `Shared ${pickedFile?.name ?? "file"}.`, note: "",
      attachment, likes: 0, liked: false, replies: [], mine: true,
    };
    if (persist([nextPost, ...posts], "Posted to this browser’s sample feed.")) { setBody(""); setPickedFile(null); }
  }

  function toggleLike(postId: string) {
    if (readOnly) return;
    persist(posts.map((post) => post.id === postId ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post), "Reaction saved in this browser.");
  }

  function addComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    if (readOnly) return;
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    const reply = { id: crypto.randomUUID(), author: profileName, body: text, createdAt: new Date().toISOString() };
    if (persist(posts.map((post) => post.id === postId ? { ...post, replies: [...post.replies, reply] } : post), "Comment added in this browser.")) setCommentDrafts({ ...commentDrafts, [postId]: "" });
  }

  function deleteDemoPost(postId: string) {
    if (readOnly || !window.confirm("Remove this post from the feed?")) return;
    persist(posts.filter((post) => post.id !== postId), "Your post was removed from this browser’s sample feed.");
  }

  return <div className="social-feed-layout">
    <main className="social-feed-column">
      <form className="social-compose" onSubmit={publish}>
        <Link className="social-avatar-link" href="/profile" aria-label="Open your profile"><MemberAvatar name={profileName} src={profileAvatar} className="social-avatar" /></Link>
        <div className="social-compose-main"><label className="sr-only" htmlFor="social-demo-body">Write a market post</label><textarea id="social-demo-body" maxLength={6000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="What’s happening in your market?" disabled={readOnly} />
          {pickedFile && <div className="social-picked-file"><span>{pickedFile.name} · {Math.ceil(pickedFile.size / 1024)} KB</span><button type="button" onClick={() => setPickedFile(null)}>Remove</button></div>}
          <div className="social-compose-actions"><label className="social-attach-button"><input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,.png,.jpg,.jpeg,.webp,.pdf,.txt,.csv" onChange={(event) => setPickedFile(event.target.files?.[0] ?? null)} disabled={readOnly} /><AttachmentIcon /> Photo / file</label><small>PNG, JPG, WEBP, PDF, text or CSV · 1 MB in local preview</small><button className="button button-dark button-small" disabled={!ready || readOnly} type="submit">Post</button></div>
          {readOnly && <p className="social-read-only">This sample feed is read-only. Approved DRACARYS Financial Traders can publish to the live feed.</p>}
          {notice && <p className="social-status" role="status">{notice}</p>}
        </div>
      </form>
      {posts.map((post) => <article className={`social-post ${expandedPostIds.includes(post.id) ? "social-post-expanded" : "social-post-collapsed"}`} key={post.id}>
        <div className="social-post-head"><MemberAvatar name={post.author} src={post.mine ? profileAvatar : undefined} className="social-avatar" /><div><strong>{post.mine ? profileName : post.author}</strong><span>{post.label} · {post.market}</span></div><time>{formatStamp(post.createdAt)} EAT</time></div>
        {!expandedPostIds.includes(post.id) ? <div className="social-post-preview"><p>{(post.title || post.body).replace(/\s+/g, " ").slice(0, 220)}{(post.title || post.body).length > 220 ? "…" : ""}</p>{post.attachment && <small>Attachment · {post.attachment.name}</small>}<button type="button" onClick={() => setExpandedPostIds((current) => [...current, post.id])}>Open post</button></div> : <>
        {post.title && <h2>{post.title}</h2>}
        <p className="social-post-body">{post.body}</p>
        {post.chartVariant && <DemoChartImage variant={post.chartVariant} caption={`${post.market} · FICTIONAL EXAMPLE`} />}
        {post.attachment && <div className="social-attachment">{post.attachment.mime.startsWith("image/") && <Image src={post.attachment.dataUrl} alt={post.attachment.name} width={1200} height={900} unoptimized />}{post.attachment.mime.startsWith("image/") ? null : <a href={post.attachment.dataUrl} download={post.attachment.name}>{post.attachment.name} · {Math.ceil(post.attachment.size / 1024)} KB <span>Download</span></a>}</div>}
        {post.note && <p className="social-post-note">{post.note}</p>}
        <div className="social-post-actions"><button type="button" className={post.liked ? "social-liked" : ""} disabled={readOnly} onClick={() => toggleLike(post.id)}><span aria-hidden="true">♡</span> Like <b>{post.likes}</b></button><button type="button" aria-label={`${post.replies.length} comments`}><span aria-hidden="true">◯</span> Comment <b>{post.replies.length}</b></button>{post.mine && !readOnly && <button type="button" className="social-demo-delete" onClick={() => deleteDemoPost(post.id)}>Delete post</button>}<span className="social-demo-tag">SAMPLE POST</span></div>
        {post.replies.length > 0 && <div className="social-comments">{post.replies.map((reply) => <div className="social-comment" key={reply.id}><MemberAvatar name={reply.author} src={reply.author === name ? profileAvatar : undefined} className="social-avatar social-avatar-small" /><div><strong>{reply.author === name ? profileName : reply.author}</strong><p>{reply.body}</p><time>{formatStamp(reply.createdAt)} EAT</time></div></div>)}</div>}
        {!readOnly && <form className="social-comment-form" onSubmit={(event) => addComment(event, post.id)}><label className="sr-only" htmlFor={`social-comment-${post.id}`}>Write a comment</label><input id={`social-comment-${post.id}`} value={commentDrafts[post.id] ?? ""} onChange={(event) => setCommentDrafts({ ...commentDrafts, [post.id]: event.target.value })} placeholder="Write a comment…" maxLength={1000} /><button type="submit" aria-label="Send comment">Send</button></form>}
        <button className="social-post-close" type="button" onClick={() => setExpandedPostIds((current) => current.filter((id) => id !== post.id))}>Close post</button>
        </>}
      </article>)}
      {!ready && <p className="social-status">Opening the sample feed…</p>}
    </main>
    <aside className="social-feed-aside"><section className="feed-aside-card"><p className="eyebrow eyebrow-dark">A GOOD POST</p><h2>Show the reasoning<br /><em>with the view.</em></h2><p>Share what you noticed, what changed and what remains uncertain.</p></section><section className="feed-aside-card feed-aside-risk"><span>DEMO CONTENT</span><p>The feed’s sample posts and local interactions are fictional. Nothing is published to other members.</p></section><Link className="feed-record-link" href="/community"><span>For live conversations</span><strong>Open the community room </strong></Link></aside>
  </div>;
}

export function MarketSocialFeed({ connected, posts, signedIn, canPublish = false, name, avatarUrl, memberId, demoMember = false, readOnlyDemo = false, demoProfileStorageKey }: { connected: boolean; posts: CommunityPost[]; signedIn: boolean; canPublish?: boolean; name: string; avatarUrl?: string | null; memberId?: string | null; demoMember?: boolean; readOnlyDemo?: boolean; demoProfileStorageKey?: string }) {
  if (!connected) return <DemoSocialFeed name={name} readOnly={readOnlyDemo} profileStorageKey={demoProfileStorageKey} />;
  return <div className="social-feed-layout">
    <main className="social-feed-column">
      <SocialPostComposer signedIn={signedIn} canPublish={canPublish} name={name} avatarUrl={avatarUrl} demoMember={demoMember} />
      {posts.length === 0 ? <div className="social-empty-state"><span className="social-empty-kicker">THE FEED IS OPEN</span><strong>No live posts yet</strong><span>This page collects trader observations, chart notes and longer analysis. Public Members can comment and use the open Community group chat.</span>{canPublish && signedIn && !demoMember ? <a href="#social-live-body">Write the first post <span aria-hidden="true"></span></a> : !signedIn ? <Link href="/sign-up">Join the community <span aria-hidden="true"></span></Link> : <Link href="/profile/trader-application">Apply for trader review <span aria-hidden="true"></span></Link>}</div> : posts.map((post) => <CommunityPostCard key={post.id} post={post} signedIn={signedIn} memberId={memberId} returnTo="/feed" />)}
    </main>
    <aside className="social-feed-aside"><section className="feed-aside-card"><p className="eyebrow eyebrow-dark">A GOOD POST</p><h2>Show the reasoning<br /><em>with the view.</em></h2><p>Share what you noticed, what changed and what remains uncertain.</p></section><section className="feed-aside-card feed-aside-risk"><span>BEFORE YOU ACT</span><p>Posts are members’ views, not recommendations. Trading carries real risk.</p></section><Link className="feed-record-link" href="/community"><span>For conversations</span><strong>Open the community room </strong></Link></aside>
  </div>;
}

function SocialPostComposer({ signedIn, canPublish, name, avatarUrl, demoMember }: { signedIn: boolean; canPublish: boolean; name: string; avatarUrl?: string | null; demoMember: boolean }) {
  const [attachmentName, setAttachmentName] = useState("");
  if (demoMember) return <div className="social-compose-locked">Demo member accounts can browse this preview. Use a member account to publish.</div>;
  if (!signedIn) return <div className="social-compose-locked"><span>Have a market note to share?</span><Link href="/sign-up">Join the community </Link></div>;
  if (!canPublish) return <div className="social-compose-locked"><strong>Feed publishing is for approved DRACARYS Financial Traders.</strong><p>Public Members can comment here and share freely in the Community group chat.</p><Link href="/profile/trader-application">Apply for trader review</Link></div>;
  return <form className="social-compose" action={publishPost}>
    <input type="hidden" name="post_kind" value="chat" /><input type="hidden" name="return_to" value="/feed" />
    <Link className="social-avatar-link" href="/profile" aria-label="Open your profile"><MemberAvatar name={name} src={avatarUrl} className="social-avatar" /></Link><div className="social-compose-main"><label className="sr-only" htmlFor="social-live-body">Write a market post</label><textarea id="social-live-body" name="body" maxLength={12000} placeholder="What’s happening in your market?" />
      <div className="social-compose-actions"><label className="social-attach-button"><input type="file" name="attachment" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,.png,.jpg,.jpeg,.webp,.pdf,.txt,.csv" onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? "")} /><AttachmentIcon />{attachmentName ? "Change file" : "Photo / file"}</label><small className="social-file-note" aria-live="polite">{attachmentName || "PNG, JPG, WEBP, PDF, text or CSV · up to 10 MB"}</small><button className="button button-dark button-small" type="submit">Post</button></div><small className="social-public-note">Posts and attachments are public to the community. Keep account or client details out.</small>
    </div>
  </form>;
}
