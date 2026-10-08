import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "The Forge" };

export default function ForgePage() {
  return <ComingSoon title="The Forge" eyebrow="Learning floor / In development" description="Guided study, practical exercises and progress tracking are planned for members who want to build and review a trading method." />;
}
