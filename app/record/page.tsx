import type { Metadata } from "next";
import { DemoSetupList, PreviewUnavailable } from "@/components/demo-sections";
import { demoSetups } from "@/lib/demo-data";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { getDemoRole } from "@/lib/demo-session";
import { FounderRecordDesk } from "@/components/founder-demo-workspace";

export const metadata: Metadata = { title: "The Dragon’s Record" };

export default async function RecordPage() {
  if (hasSupabaseConfig()) return <PreviewUnavailable title="The Dragon’s Record" />;
  const founderDemo = (await getDemoRole()) === "founder";
  return <section className="demo-page">
    <div className="demo-page-head"><p className="eyebrow eyebrow-dark">THE DRAGON’S RECORD</p><h1>Every setup stays<br /><em>on the record.</em></h1><p>Walk through publication, outcome, personal execution and review as separate entries.</p></div>
    <div className="demo-notice"><strong>DEMO DATA</strong><span>Three fictional setups: one win, one loss and one unresolved. No performance claims.</span></div>
    {founderDemo && <FounderRecordDesk />}
    <DemoSetupList setups={demoSetups} />
  </section>;
}
