import { CORRIDORS, CURRENCY_META, formatCurrency, MARKET_STATUS_META } from "@/lib/corridors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Corridors() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-12">
      <h2 className="text-xl font-semibold">Cross-border corridors</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {CORRIDORS.map((corridor) => (
          <Card key={corridor.id}>
            <CardHeader>
              <CardTitle>
                {MARKET_STATUS_META[corridor.from].label} &rarr; {MARKET_STATUS_META[corridor.to].label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{corridor.fromCurrency}</Badge>
                <span>&rarr;</span>
                <Badge variant="outline">{corridor.toCurrency}</Badge>
                {CURRENCY_META[corridor.toCurrency].exponent === 0 && <Badge variant="secondary">zero-decimal</Badge>}
              </div>
              <span>
                Limits: {formatCurrency(corridor.minAmountMinor, corridor.fromCurrency)} &ndash;{" "}
                {formatCurrency(corridor.maxAmountMinor, corridor.fromCurrency)}
              </span>
              <span>Cut-off: {corridor.cutoffHourUtc}:00 UTC</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
