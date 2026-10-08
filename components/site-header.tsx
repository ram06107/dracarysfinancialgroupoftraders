import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { MainNavigation } from "@/components/main-navigation";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { getDemoRole } from "@/lib/demo-session";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  let signedIn = false;
  let admin = false;
  let displayName = "";
  let demoRole: "member" | "founder" | null = null;

  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      signedIn = Boolean(data.user);
      displayName = data.user?.user_metadata?.display_name || "Member";
      if (data.user) {
        try {
          const { data: profile } = await supabase.from("public_member_profiles").select("public_name").eq("id", data.user.id).maybeSingle();
          displayName = profile?.public_name || displayName;
        } catch {
          // Keep the account metadata name if the public profile is unavailable.
        }
        try {
          const { data: isAdmin } = await supabase.rpc("request_is_admin");
          admin = isAdmin === true;
        } catch {
          // The administrator link stays hidden when role lookup is unavailable.
        }
      }
    } catch {
      signedIn = false;
    }
  } else {
    demoRole = await getDemoRole();
    signedIn = demoRole !== null;
    displayName = demoRole === "founder" ? "Founder Trader Demo" : demoRole === "member" ? "Demo member" : "";
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="wordmark" aria-label="DRACARYS home">
          <BrandMark />
          <span><strong>DRACARYS</strong><small>FINANCIAL GROUP OF TRADERS</small></span>
        </Link>
        <MainNavigation signedIn={signedIn} admin={admin} />
        <div className="header-account">
          {signedIn ? (
            <span className="member-greeting">{displayName}</span>
          ) : (
            <>
              <Link className="header-login" href="/sign-in">Log in</Link>
              <Link className="button button-dark button-small" href="/sign-up">Join free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
