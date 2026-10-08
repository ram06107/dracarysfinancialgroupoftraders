import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type GroupReaction = "like" | "love" | "fire" | "think" | "eyes";
export type CommunityChatMessage = {
  id: string;
  author_id: string;
  author: string;
  is_verified_trader: boolean;
  body: string;
  created_at: string;
  edited_at: string | null;
  message_kind: "chat" | "signal" | "setup" | "file";
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  entry_zone: string | null;
  invalidation: string | null;
  target_idea: string | null;
  attachment: { name: string; mime: string; size: number; url: string } | null;
  reply_to: { id: string; author: string; body: string } | null;
  reactions: Record<GroupReaction, number>;
  my_reactions: GroupReaction[];
};

const emptyCounts = (): Record<GroupReaction, number> => ({ like: 0, love: 0, fire: 0, think: 0, eyes: 0 });
const empty = { connected: false, signedIn: false, name: "Member", avatarKey: null as string | null, avatarUrl: undefined as string | undefined, memberId: null as string | null, roomId: null as string | null, messages: [] as CommunityChatMessage[] };

export async function getCommunityChat() {
  if (!hasSupabaseConfig()) return empty;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  let name = user?.user_metadata?.display_name || "Member";
  let avatarKey: string | null = null;
  let avatarUrl: string | undefined;

  if (user) {
    const { data: profile } = await supabase.from("public_member_profiles").select("public_name, avatar_key").eq("id", user.id).maybeSingle();
    name = profile?.public_name || name;
    avatarKey = profile?.avatar_key ?? null;
    if (avatarKey && !["monogram", "dragon"].includes(avatarKey) && !avatarKey.startsWith("data:image/")) {
      avatarUrl = supabase.storage.from("profile-avatars").getPublicUrl(avatarKey).data.publicUrl;
    }
  }

  let roomId: string | null = null;
  if (user) {
    const joined = await supabase.rpc("ensure_community_room");
    if (joined.error) return { connected: true, signedIn: true, name, avatarKey, avatarUrl, memberId: user.id, roomId, messages: [] as CommunityChatMessage[], failed: true };
    roomId = typeof joined.data === "string" ? joined.data : null;
  } else {
    const { data: room, error } = await supabase.from("rooms").select("id").eq("slug", "community").maybeSingle();
    if (error) return { connected: true, signedIn: false, name, avatarKey, avatarUrl, memberId: null, roomId, messages: [] as CommunityChatMessage[], failed: true };
    roomId = room?.id ?? null;
  }

  if (!roomId) return { connected: true, signedIn: Boolean(user), name, avatarKey, avatarUrl, memberId: user?.id ?? null, roomId, messages: [] as CommunityChatMessage[] };

  const { data: rows, error: messagesError } = await supabase
    .from("messages")
    .select("id, author_id, body, created_at, edited_at, message_kind, instrument, direction, entry_zone, invalidation, target_idea, attachment_key, attachment_name, attachment_mime, attachment_size, reply_to_message_id")
    .eq("room_id", roomId)
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (messagesError) return { connected: true, signedIn: Boolean(user), name, avatarKey, avatarUrl, memberId: user?.id ?? null, roomId, messages: [] as CommunityChatMessage[], failed: true };

  const messages = rows ?? [];
  const ids = messages.map((message) => message.id);
  const replyIds = [...new Set(messages.flatMap((message) => message.reply_to_message_id ? [message.reply_to_message_id] : []))];
  const [profileResult, reactionSummaryResult, replyResult] = await Promise.all([
    messages.length ? supabase.from("public_member_profiles").select("id, public_name").in("id", [...new Set(messages.map((message) => message.author_id))]) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.rpc("community_reaction_summary", { p_message_ids: ids }) : Promise.resolve({ data: [], error: null }),
    replyIds.length ? supabase.from("messages").select("id, author_id, body").in("id", replyIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const authors = [...new Set([...messages.map((message) => message.author_id), ...(replyResult.data ?? []).map((message) => message.author_id)])];
  const replyAuthorsNotLoaded = authors.filter((id) => !(profileResult.data ?? []).some((profile) => profile.id === id));
  const replyProfiles = replyAuthorsNotLoaded.length
    ? await supabase.from("public_member_profiles").select("id, public_name").in("id", replyAuthorsNotLoaded)
    : { data: [], error: null };
  const names = new Map([...(profileResult.data ?? []), ...(replyProfiles.data ?? [])].map((profile) => [profile.id, profile.public_name]));
  const verifiedResult = messages.length
    ? await supabase.from("trader_profiles").select("member_id").in("member_id", [...new Set(messages.map((message) => message.author_id))]).eq("is_published", true)
    : { data: [], error: null };
  const verifiedIds = new Set((verifiedResult.data ?? []).map((profile) => profile.member_id));
  const replyMap = new Map((replyResult.data ?? []).map((reply) => [reply.id, reply]));
  const counts = new Map<string, Record<GroupReaction, number>>();
  const mine = new Map<string, GroupReaction[]>();
  for (const reaction of reactionSummaryResult.data ?? []) {
    if (!(reaction.reaction in emptyCounts())) continue;
    const key = reaction.reaction as GroupReaction;
    const values = counts.get(reaction.message_id) ?? emptyCounts();
    values[key] = Number(reaction.reaction_count) || 0;
    counts.set(reaction.message_id, values);
    if (reaction.reacted_by_me) {
      const myValues = mine.get(reaction.message_id) ?? [];
      myValues.push(key);
      mine.set(reaction.message_id, myValues);
    }
  }

  return {
    connected: true,
    signedIn: Boolean(user),
    name,
    avatarKey,
    avatarUrl,
    memberId: user?.id ?? null,
    roomId,
    messages: messages.map((message) => {
      const reply = message.reply_to_message_id ? replyMap.get(message.reply_to_message_id) : null;
      return {
        id: message.id,
        author_id: message.author_id,
        author: names.get(message.author_id) ?? "Member",
        is_verified_trader: verifiedIds.has(message.author_id),
        body: message.body,
        created_at: message.created_at,
        edited_at: message.edited_at,
        message_kind: message.message_kind ?? "chat",
        instrument: message.instrument ?? null,
        direction: message.direction ?? null,
        entry_zone: message.entry_zone ?? null,
        invalidation: message.invalidation ?? null,
        target_idea: message.target_idea ?? null,
        attachment: message.attachment_key ? {
          name: message.attachment_name ?? "Shared file",
          mime: message.attachment_mime ?? "application/octet-stream",
          size: message.attachment_size ?? 0,
          url: supabase.storage.from("community-files").getPublicUrl(message.attachment_key).data.publicUrl,
        } : null,
        reply_to: reply ? { id: reply.id, author: names.get(reply.author_id) ?? "Member", body: reply.body } : null,
        reactions: counts.get(message.id) ?? emptyCounts(),
        my_reactions: mine.get(message.id) ?? [],
      };
    }),
  };
}
