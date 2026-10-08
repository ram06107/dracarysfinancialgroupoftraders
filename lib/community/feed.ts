import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type CommunityComment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: string;
  is_verified_trader: boolean;
};

type ReactionKind = "like" | "insightful" | "question";

export type CommunityPost = {
  id: string;
  author_id: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
  author: string;
  is_verified_trader: boolean;
  post_kind: "chat" | "signal" | "setup" | "file";
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  entry_zone: string | null;
  invalidation: string | null;
  target_idea: string | null;
  attachment: { name: string; mime: string; size: number; url: string } | null;
  comments: CommunityComment[];
  reactions: Record<ReactionKind, number | null>;
  myReactions: string[];
};

const emptyFeed = { connected: false, signedIn: false, canPublish: false, member: null, posts: [] as CommunityPost[] };

export async function getCommunityFeed() {
  if (!hasSupabaseConfig()) return emptyFeed;

  const supabase = await createClient();
  const [userResult, postsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("posts")
      .select("id, author_id, body, created_at, post_kind, instrument, direction, entry_zone, invalidation, target_idea, attachment_key, attachment_name, attachment_mime, attachment_size")
      .eq("visibility", "public")
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const posts = postsResult.data ?? [];
  const user = userResult.data.user;
  const { data: canPublishData } = user ? await supabase.rpc("request_can_publish_feed") : { data: false };
  const canPublish = canPublishData === true;
  const memberIds = [...new Set([...posts.map((post) => post.author_id), ...(user ? [user.id] : [])])];
  const profilesResult = memberIds.length
    ? await supabase.from("public_member_profiles").select("id, public_name, avatar_key").in("id", memberIds)
    : { data: [], error: null };
  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const getAvatarUrl = (avatarKey: string | null | undefined) => {
    if (!avatarKey || avatarKey === "monogram") return null;
    if (avatarKey === "dragon") return "/dracarys-mark.png";
    return supabase.storage.from("profile-avatars").getPublicUrl(avatarKey).data.publicUrl;
  };
  const memberProfile = user ? profilesById.get(user.id) : null;
  const member = user ? {
    id: user.id,
    public_name: memberProfile?.public_name ?? user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Member",
    avatar_url: getAvatarUrl(memberProfile?.avatar_key),
  } : null;

  if (postsResult.error || posts.length === 0) return {
    connected: true,
    signedIn: Boolean(user),
    canPublish,
    member,
    posts: [] as CommunityPost[],
    ...(postsResult.error ? { failed: true } : {}),
  };

  const postIds = posts.map((post) => post.id);
  const [commentsResult, totalsResult, mineResult] = await Promise.all([
    supabase
      .from("comments")
      .select("id, post_id, author_id, body, created_at")
      .in("post_id", postIds)
      .is("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(90),
    supabase
      .from("community_post_reaction_totals")
      .select("post_id, reaction, total")
      .in("post_id", postIds),
    userResult.data.user
      ? supabase
          .from("post_reactions")
          .select("post_id, reaction")
          .eq("member_id", userResult.data.user.id)
          .in("post_id", postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const commentAuthorIds = [...new Set((commentsResult.data ?? []).map((comment) => comment.author_id))];
  const allAuthorIds = [...new Set([...posts.map((post) => post.author_id), ...commentAuthorIds])];
  const [commentProfilesResult, verifiedResult] = await Promise.all([
    commentAuthorIds.length
      ? supabase.from("public_member_profiles").select("id, public_name").in("id", commentAuthorIds)
      : Promise.resolve({ data: [], error: null }),
    allAuthorIds.length
      ? supabase.from("trader_profiles").select("member_id").in("member_id", allAuthorIds).eq("is_published", true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const names = new Map([...profilesById].map(([id, profile]) => [id, profile.public_name]));
  for (const profile of commentProfilesResult.data ?? []) names.set(profile.id, profile.public_name);
  const verifiedIds = new Set((verifiedResult.data ?? []).map((trader) => trader.member_id));
  const commentsByPost = new Map<string, CommunityComment[]>();
  for (const comment of commentsResult.data ?? []) {
    const list = commentsByPost.get(comment.post_id) ?? [];
    list.push({ ...comment, author: names.get(comment.author_id) ?? "Member", is_verified_trader: verifiedIds.has(comment.author_id) });
    commentsByPost.set(comment.post_id, list);
  }
  for (const list of commentsByPost.values()) list.reverse();

  const totalsByPost = new Map<string, Record<ReactionKind, number | null>>();
  for (const row of totalsResult.data ?? []) {
    const totals = totalsByPost.get(row.post_id) ?? {
      like: totalsResult.error ? null : 0,
      insightful: totalsResult.error ? null : 0,
      question: totalsResult.error ? null : 0,
    };
    if (row.reaction in totals) totals[row.reaction as keyof typeof totals] = row.total;
    totalsByPost.set(row.post_id, totals);
  }
  const mineByPost = new Map<string, string[]>();
  for (const row of mineResult.data ?? []) {
    const values = mineByPost.get(row.post_id) ?? [];
    values.push(row.reaction);
    mineByPost.set(row.post_id, values);
  }

  return {
    connected: true,
    signedIn: Boolean(user),
    canPublish,
    member,
    posts: posts.map((post) => ({
      id: post.id,
      author_id: post.author_id,
      author_avatar_url: getAvatarUrl(profilesById.get(post.author_id)?.avatar_key),
      body: post.body,
      created_at: post.created_at,
      post_kind: post.post_kind ?? "chat",
      is_verified_trader: verifiedIds.has(post.author_id),
      instrument: post.instrument ?? null,
      direction: post.direction ?? null,
      entry_zone: post.entry_zone ?? null,
      invalidation: post.invalidation ?? null,
      target_idea: post.target_idea ?? null,
      attachment: post.attachment_key ? {
        name: post.attachment_name ?? "Shared file",
        mime: post.attachment_mime ?? "application/octet-stream",
        size: post.attachment_size ?? 0,
        url: supabase.storage.from("community-files").getPublicUrl(post.attachment_key).data.publicUrl,
      } : null,
      author: names.get(post.author_id) ?? "Member",
      comments: commentsByPost.get(post.id) ?? [],
      reactions: totalsByPost.get(post.id) ?? {
        like: totalsResult.error ? null : 0,
        insightful: totalsResult.error ? null : 0,
        question: totalsResult.error ? null : 0,
      },
      myReactions: mineByPost.get(post.id) ?? [],
    })),
  };
}
