import { cookies } from "next/headers";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const DEMO_MEMBER_COOKIE = "dracarys_demo_member";

export type DemoRole = "member" | "founder";

export async function getDemoRole(): Promise<DemoRole | null> {
  if (hasSupabaseConfig()) return null;
  const cookieStore = await cookies();
  const role = cookieStore.get(DEMO_MEMBER_COOKIE)?.value;
  if (role === "founder") return "founder";
  if (role === "read-only") return "member";
  return null;
}

export async function hasDemoMemberSession() {
  return (await getDemoRole()) === "member";
}
