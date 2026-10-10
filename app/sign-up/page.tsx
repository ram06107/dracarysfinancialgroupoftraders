import type { Metadata } from "next";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { DemoSignInCard } from "@/components/demo-sign-in";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Join free" };

const messages: Record<string, string> = {
  setup: "Account services are not connected yet. Configure the Supabase settings to enable registration.",
  details: "Add your name, a valid email and a password of at least 10 characters.",
  password: "Use at least 10 characters, including an uppercase letter, a lowercase letter, a number and a symbol.",
  "email-in-use": "This email may already have an account. Sign in or reset your password instead.",
  rate: "Too many signup attempts were made recently. Wait a little before trying again.",
  signup: "We couldn't finish creating your account. Check your details and try again. If it keeps failing, contact the DRACARYS team.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? messages[query.error] : undefined;
  const accountsConnected = hasSupabaseConfig();

  return (
    <section className="auth-page auth-page-signup">
      <div className="auth-copy">
        <Link href="/" className="auth-brand" aria-label="DRACARYS home">
          <BrandMark />
          <span><strong>DRACARYS</strong><small>FINANCIAL GROUP OF TRADERS</small></span>
        </Link>
        <p className="eyebrow eyebrow-dark">Free to join</p>
        <h1>Bring your<br /><em>own point of view.</em></h1>
        <p>Read the room, learn from professional traders and add to the conversation when you have something to say.</p>
        <div className="auth-rule-note"><span>DRACARYS / COMMUNITY</span><span>02 — 02</span></div>
      </div>
      <div className="auth-panel">
        <h2>Create your account</h2>
        <p className="auth-panel-intro">{accountsConnected ? "New accounts join as Public Members. Professional Trader access is a separate application with identity, background and process review. The community is free; no card details or performance promises." : "Account creation is offline in this preview. Use the read-only demo to explore the member view."}</p>
        {error && <p className="form-alert" role="alert">{error}</p>}
        {accountsConnected ? <>
        <form action={signUp} className="auth-form">
          <label htmlFor="display_name">Name</label>
          <input id="display_name" name="display_name" type="text" autoComplete="name" minLength={2} maxLength={80} required />
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Password <span>10+ characters; uppercase, lowercase, number, symbol</span></label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{10,128}" title="Use at least 10 characters, including an uppercase letter, a lowercase letter, a number and a symbol." required />
          <button className="button button-dark auth-submit" type="submit">Join the community <span aria-hidden="true"></span></button>
        </form>
        </> : <DemoSignInCard />}
        <p className="auth-switch">Already a member? <Link href="/sign-in">Log in</Link></p>
      </div>
    </section>
  );
}
