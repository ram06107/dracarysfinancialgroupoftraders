import type { Metadata } from "next";
import Link from "next/link";
import { sendPasswordReset } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Recover your account" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const accountsConnected = hasSupabaseConfig();
  const error = typeof query.error === "string" ? query.error : "";
  const sent = query.notice === "check-email";

  return <section className="auth-page auth-page-recovery">
    <div className="auth-copy">
      <Link href="/" className="auth-brand" aria-label="DRACARYS home"><BrandMark /><span><strong>DRACARYS</strong><small>FINANCIAL GROUP OF TRADERS</small></span></Link>
      <p className="eyebrow eyebrow-dark">ACCOUNT RECOVERY</p>
      <h1>Find your way<br /><em>back in.</em></h1>
      <p>We’ll email you a private link to choose a new password. The link works once and expires for your security.</p>
      <div className="auth-rule-note"><span>DRACARYS / ACCOUNT ACCESS</span><span>RECOVERY</span></div>
    </div>
    <div className="auth-panel">
      <h2>Reset your password</h2>
      <p className="auth-panel-intro">Enter the email address on your account. If we find a match, recovery instructions will be sent.</p>
      {error === "setup" && <p className="form-alert" role="alert">Account services are not connected. Please try again later.</p>}
      {error === "email" && <p className="form-alert" role="alert">Enter a valid email address.</p>}
      {sent ? <p className="form-success" role="status">If an account matches that address, a password reset link is on its way. Check your inbox and spam folder.</p> : accountsConnected ? <form action={sendPasswordReset} className="auth-form">
        <label htmlFor="recovery-email">Email</label>
        <input id="recovery-email" name="email" type="email" autoComplete="email" required />
        <button className="button button-dark auth-submit" type="submit">Send recovery link <span aria-hidden="true"></span></button>
      </form> : <p className="form-alert" role="status">Account recovery is offline in this preview.</p>}
      <p className="auth-switch"><Link href="/sign-in">Back to log in</Link></p>
    </div>
  </section>;
}
