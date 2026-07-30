import Link from "next/link";
import { MARKETS, MARKET_STATUS_META } from "@/lib/corridors";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Hoscoo. Unified payment orchestration.</p>
        <div className="flex flex-wrap gap-4">
          {MARKETS.map((market) => (
            <span key={market}>
              {MARKET_STATUS_META[market].label}: {MARKET_STATUS_META[market].status === "LIVE" ? "live" : "planned"}
            </span>
          ))}
        </div>
        <div className="flex gap-4">
          <Link href="/sandbox/portal" className="hover:text-foreground">
            Sandbox portal
          </Link>
          <a href="/openapi/v1.json" target="_blank" rel="noreferrer" className="hover:text-foreground">
            OpenAPI
          </a>
        </div>
      </div>
    </footer>
  );
}
