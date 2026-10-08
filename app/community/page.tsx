import type { Metadata } from "next";
import { CommunityChat } from "@/components/community-chat";
import { CommunityRoomPreview } from "@/components/community-room-preview";
import { getCommunityChat } from "@/lib/community/chat";
import { getDemoRole } from "@/lib/demo-session";

export const metadata: Metadata = { title: "Community" };

const notices: Record<string, string> = {
  setup: "Community storage is not connected yet. Add the database settings to bring this room online.",
  chat: "That message could not be sent. Check the message and try again.",
  file: "That file could not be shared. Choose a supported image or file under 10 MB.",
  edit: "That message could not be updated. Try again.",
  reaction: "That reaction could not be saved. Try again.",
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const chat = await getCommunityChat();
  let signedIn = chat.signedIn;
  let demoMember = false;
  let founderDemo = false;
  let name = "Member";

  if (chat.connected) {
    name = chat.name;
  } else {
    const demoRole = await getDemoRole();
    demoMember = demoRole === "member";
    founderDemo = demoRole === "founder";
    signedIn = demoRole !== null;
    if (demoMember) name = "Demo Member";
    if (founderDemo) name = "Founder Trader";
  }

  const queryError = typeof query.error === "string" ? query.error : "";
  const demoProfileKey = founderDemo ? "dracarys_profile_founder_v1" : demoMember ? "dracarys_profile_member_v1" : undefined;

  return (
    <div className="community-page">
      {(queryError || query.sent) && <p className={`community-toast ${queryError ? "community-toast-error" : ""}`} role="status">{query.sent ? "Your message has been sent." : notices[queryError] ?? "Something went wrong. Please try again."}</p>}
      {!chat.connected ? <CommunityRoomPreview name={founderDemo ? name : demoMember ? name : "Preview member"} readOnly={demoMember} profileStorageKey={demoProfileKey} /> : <CommunityChat messages={chat.messages} signedIn={signedIn} name={name} avatarKey={chat.avatarKey} avatarUrl={chat.avatarUrl} memberId={chat.memberId} roomId={chat.roomId} failed={"failed" in chat && chat.failed} />}
    </div>
  );
}
