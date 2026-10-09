import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import "./site.css";

export const metadata: Metadata = {
  title: {
    default: "DRACARYS — Financial Group of Traders",
    template: "%s | DRACARYS",
  },
  description:
    "A trading community built around documented analysis, a lasting record and learning together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {!hasSupabaseConfig() && <div className="global-demo-banner"><strong>DEMO DATA</strong><span>Fictional examples are shown for observation. No live trader or member activity is connected.</span></div>}
        <main>{children}</main>
        <footer className="site-footer">
          <div className="footer-inner">
            <span>DRACARYS <span className="footer-muted">Financial Group of Traders</span></span>
            <p>Trading involves substantial risk. Past performance does not guarantee future results. Education is not financial advice.</p>
            <div className="footer-links"><a href="/about">About</a><a href="/traders">Traders</a><a href="/record">Record</a><a href="/community">Community</a></div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
