"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/community", "Community"],
  ["/feed", "Feed"],
  ["/traders", "Traders"],
  ["/record", "Record"],
  ["/analytics", "Analytics"],
  ["/profile", "Profile"],
] as const;

export function MainNavigation({ signedIn, admin = false }: { signedIn: boolean; admin?: boolean }) {
  const pathname = usePathname();
  return <nav className="main-nav" aria-label="Main navigation">
    {links.filter(([href]) => href !== "/profile" || signedIn).map(([href, label]) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} className={active ? "main-nav-link-current" : undefined} aria-current={active ? "page" : undefined}>{label}</Link>;
    })}
    {admin && <Link href="/admin" className={pathname === "/admin" ? "main-nav-link-current" : undefined} aria-current={pathname === "/admin" ? "page" : undefined}>Admin</Link>}
    <details className="nav-more"><summary className={pathname === "/about" || pathname.startsWith("/chronicle") || pathname.startsWith("/forge") || pathname.startsWith("/war-room") ? "main-nav-link-current" : undefined}>Explore</summary><div className="nav-more-menu">
      {signedIn && <Link href="/profile">My profile</Link>}
      <Link href="/chronicle">The Chronicle <small>Coming soon</small></Link><Link href="/forge">The Forge <small>Coming soon</small></Link><Link href="/war-room">War Room <small>Coming soon</small></Link>{signedIn && <Link href="/profile#personal-journal">Personal journal</Link>}<Link href="/about">Our approach</Link>
    </div></details>
  </nav>;
}
