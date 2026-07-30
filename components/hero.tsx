import Link from "next/link";
import { CHANNELS, MNOS } from "@/lib/providers";
import { MARKETS, MARKET_STATUS_META } from "@/lib/corridors";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  const liveMarkets = MARKETS.filter((m) => MARKET_STATUS_META[m].status === "LIVE");

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-20">
      <Badge variant="outline" className="w-fit">
        {CHANNELS.length} channels &middot; {MNOS.length} wallet providers &middot; {liveMarkets.length} live market
      </Badge>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        One integration, every rail money moves on in East Africa.
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Wallet-to-wallet, bank-to-wallet, card checkout, and cross-border corridors behind a single dual-leg payload
        and a single signing scheme.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/sandbox/portal" className={buttonVariants({ size: "lg" })}>
          Start in sandbox
        </Link>
        <a href="/openapi/v1.json" target="_blank" rel="noreferrer" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Read the API reference
        </a>
      </div>
    </section>
  );
}
