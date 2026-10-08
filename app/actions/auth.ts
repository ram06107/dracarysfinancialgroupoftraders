"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { DEMO_MEMBER_COOKIE } from "@/lib/demo-session";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signIn(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/sign-in?error=setup");

  const email = formValue(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!email || typeof password !== "string" || !password) {
    redirect("/sign-in?error=signin");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") {
    redirect("/sign-in?error=unconfirmed");
  }
  if (error) redirect("/sign-in?error=signin");
  redirect("/community");
}

export async function resendSignupConfirmation(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/sign-in?error=setup");

  const email = formValue(formData, "email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/sign-in?error=email");

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/community` },
  });

  if (error) redirect("/sign-in?error=resend");
  redirect("/sign-in?notice=confirmation-sent");
}

export async function sendPasswordReset(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/forgot-password?error=setup");

  const email = formValue(formData, "email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect("/forgot-password?error=email");

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", "/reset-password");
  // Keep the response the same whether or not the email belongs to an account.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
  redirect("/forgot-password?notice=check-email");
}

export async function demoSignIn(formData: FormData) {
  if (hasSupabaseConfig()) redirect("/sign-in");

  const role = formData.get("role") === "founder" ? "founder" : "read-only";
  const cookieStore = await cookies();
  cookieStore.set(DEMO_MEMBER_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  redirect(role === "founder" ? "/record" : "/community");
}

export async function signUp(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/sign-up?error=setup");

  const displayName = formValue(formData, "display_name");
  const email = formValue(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (
    displayName.length < 2 ||
    displayName.length > 80 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  ) {
    redirect("/sign-up?error=details");
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=/community`,
    },
  });

  if (error) redirect("/sign-up?error=signup");
  if (data.session) redirect("/community");
  redirect("/sign-in?notice=check-email");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_MEMBER_COOKIE);
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
