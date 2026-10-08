import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PasswordResetForm } from "@/components/password-reset-form";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  let hasValidSession = false;
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    hasValidSession = Boolean(data.user);
  }
  const recoveryError = query.error === "auth" || !hasValidSession;

  return <section className="auth-page auth-page-recovery">
    <div className="auth-copy">
      <Link href="/" className="auth-brand" aria-label="DRACARYS home"><BrandMark /><span><strong>DRACARYS</strong><small>FINANCIAL GROUP OF TRADERS</small></span></Link>
      <p className="eyebrow eyebrow-dark">ACCOUNT RECOVERY</p>
      <h1>A fresh start<br /><em>for your password.</em></h1>
      <p>Choose a new password you haven’t used for this account before.</p>
      <div className="auth-rule-note"><span>DRACARYS / ACCOUNT ACCESS</span><span>SECURE RESET</span></div>
    </div>
    <div className="auth-panel">
      <h2>Choose a new password</h2>
      <p className="auth-panel-intro">Use at least 10 characters. You’ll be signed in after it’s changed.</p>
      {recoveryError ? <p className="form-alert" role="alert">This recovery link has expired or was already used. Request a fresh email to continue.</p> : <PasswordResetForm />}
      <p className="auth-switch">Need another link? <Link href="/forgot-password">Request a new recovery email</Link></p>
    </div>
  </section>;
}
