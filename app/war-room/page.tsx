import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "The War Room" };

export default function WarRoomPage() {
  return <ComingSoon title="The War Room" eyebrow="Mentorship / In development" description="A dedicated place for structured trader questions, thoughtful feedback and mentorship is planned for a later release." />;
}
