import { MARKETS, MARKET_STATUS_META } from "@/lib/corridors";
import { MNOS, BANKS } from "@/lib/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Coverage() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-12">
      <h2 className="text-xl font-semibold">Market coverage</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MARKETS.map((market) => {
          const meta = MARKET_STATUS_META[market];
          const wallets = MNOS.filter((m) => m.market === market).length;
          const banks = BANKS.filter((b) => b.market === market).length;
          return (
            <Card key={market}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{meta.label}</span>
                  <Badge variant={meta.status === "LIVE" ? "success" : "outline"}>{meta.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span>{meta.currency}</span>
                <span>
                  {wallets} wallet provider{wallets === 1 ? "" : "s"}
                </span>
                <span>
                  {banks} bank{banks === 1 ? "" : "s"}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
