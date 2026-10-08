"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}
