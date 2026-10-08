import type { Metadata } from "next";
import Link from "next/link";
import { resendSignupConfirmation, signIn } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { DemoSignInCard } from "@/components/demo-sign-in";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Log in" };

const messages: Record<string, string> = {
  setup: "Account services are not connected yet. Configure the Supabase settings to enable sign-in.",
  signin: "Those details did not match an account. Check them and try again.",
  unconfirmed: "Your email address still needs confirmation. Check your inbox and spam folder, or request a fresh link below.",
  email: "Enter the email address you used to create your account.",
  resend: "We could not send a confirmation email right now. Wait a minute and try again.",
  auth: "That sign-in link could not be verified. Request a fresh one and try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? messages[query.error] : undefined;
  const notice = typeof query.notice === "string" ? query.notice : "";
  const accountsConnected = hasSupabaseConfig();

  return (
    <section className="auth-page">
      <div className="auth-copy">
        <Link href="/" className="auth-brand" aria-label="DRACARYS home">
          <BrandMark />
          <span><strong>DRACARYS</strong><small>FINANCIAL GROUP OF TRADERS</small></span>
        </Link>
        <p className="eyebrow eyebrow-dark">Good to have you back</p>
        <h1>Pick up where<br /><em>you left off.</em></h1>
        <p>The community is built on real conversations. Sign in to take part.</p>
        <div className="auth-rule-note"><span>DRACARYS / MEMBER ACCESS</span><span>02 — 01</span></div>
      </div>
      <div className="auth-panel">
        <h2>Log in</h2>
        <p className="auth-panel-intro">{accountsConnected ? "Use the email address and password you joined with." : "Account services are offline in this preview. You can still explore the member view below."}</p>
        {error && <p className="form-alert" role="alert">{error}</p>}
        {notice === "check-email" && <p className="form-success" role="status">Check your inbox for the confirmation link. It may take a minute to arrive.</p>}
        {notice === "confirmation-sent" && <p className="form-success" role="status">If that account still needs confirmation, a fresh link is on its way. Check your inbox and spam folder.</p>}
        {notice === "join" && <p className="form-success" role="status">Log in to join the conversation.</p>}
        {accountsConnected ? <>
        <form action={signIn} className="auth-form">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Password <Link href="/forgot-password">Forgot password?</Link></label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          <button className="button button-dark auth-submit" type="submit">Log in <span aria-hidden="true"></span></button>
        </form>
        </> : <DemoSignInCard />}
        {accountsConnected && <form action={resendSignupConfirmation} className="auth-resend-form">
          <label htmlFor="resend-email">Need a confirmation link?</label>
          <div><input id="resend-email" name="email" type="email" autoComplete="email" placeholder="Email used to join" required /><button type="submit">Resend link</button></div>
        </form>}
        <p className="auth-switch">New here? <Link href="/sign-up">Create a free account</Link></p>
      </div>
    </section>
  );
}
