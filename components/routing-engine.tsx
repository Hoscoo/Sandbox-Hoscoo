import { RAILS, railCost, crossoverAmount } from "@/lib/corridors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SAMPLE_AMOUNTS_MINOR = [10_000n, 100_000n];

export function RoutingEngine() {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-12">
      <div>
        <h2 className="text-xl font-semibold">How routing decides</h2>
        <p className="text-sm text-muted-foreground">
          Eligibility (market status, rail health, amount limits) is always evaluated before cost. A cheaper rail
          that fails eligibility is never selected — see <code className="rounded bg-muted px-1">selectRoute</code>{" "}
          in <code className="rounded bg-muted px-1">lib/corridors.ts</code>.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RAILS.map((rail) => (
          <Card key={rail}>
            <CardHeader>
              <CardTitle>{rail}</CardTitle>
              <CardDescription>Cost at sample amounts (minor units)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              {SAMPLE_AMOUNTS_MINOR.map((amount) => (
                <div key={amount.toString()} className="flex justify-between text-muted-foreground">
                  <span>{amount.toLocaleString("en-US")}</span>
                  <span>{railCost(rail, amount).toLocaleString("en-US")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="text-sm text-muted-foreground">
        Crossover: MNO_INTERCONNECT &rarr; TIPS becomes cheaper at{" "}
        {crossoverAmount("MNO_INTERCONNECT", "TIPS")?.toLocaleString("en-US") ?? "never"} minor units — derived from
        the fee model, not hardcoded.
      </div>
    </section>
  );
}
