import { demoSignIn } from "@/app/actions/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export function DemoSignInCard() {
  if (hasSupabaseConfig()) return null;

  return (
    <section className="demo-access-card">
      <span className="demo-access-label">LOCAL PREVIEW / NO ACCOUNT NEEDED</span>
      <h3>Take a look around.</h3>
      <p>Choose a preview role. Both accounts use sample material; the founder workspace saves your drafts only in this browser.</p>
      <div className="demo-access-options">
        <form action={demoSignIn}>
          <input type="hidden" name="role" value="founder" />
          <button className="button button-dark auth-submit" type="submit">Continue as Founder Trader Demo <span aria-hidden="true"></span></button>
          <small>Full preview access · local drafts</small>
        </form>
        <form action={demoSignIn}>
          <input type="hidden" name="role" value="member" />
          <button className="button button-outline auth-submit" type="submit">Continue as demo member <span aria-hidden="true"></span></button>
          <small>Read-only sample access</small>
        </form>
      </div>
    </section>
  );
}
