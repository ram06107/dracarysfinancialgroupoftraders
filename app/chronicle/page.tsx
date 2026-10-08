import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "The Chronicle" };

export default function ChroniclePage() {
  return <ComingSoon title="The Chronicle" eyebrow="Group history / In development" description="A considered history of published setups, decisions and weekly reflections is planned here. Each entry will link back to the record it came from." />;
}
