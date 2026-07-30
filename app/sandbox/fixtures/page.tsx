import { ALL_FIXTURES, type FixtureCategory } from "@/lib/sandbox/fixtures";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABELS: Record<FixtureCategory, string> = {
  WALLET_TO_WALLET: "Wallet to wallet",
  BANK_TO_BANK: "Bank to bank",
  GATEWAY_CHECKOUT: "Card / gateway checkout",
  CROSS_BORDER: "Cross-border corridors",
};

export default function FixturesPage() {
  const categories = Array.from(new Set(ALL_FIXTURES.map((f) => f.category)));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Badge variant="sandbox" className="w-fit">
          Sandbox
        </Badge>
        <h1 className="text-2xl font-semibold">Deterministic fixtures</h1>
        <p className="text-muted-foreground">
          Every magic value below always produces the same outcome. This table is rendered directly from{" "}
          <code className="rounded bg-muted px-1 py-0.5">lib/sandbox/fixtures.ts</code> — the same source the
          simulation engine and tests read from, so this page can never drift from actual behavior.
        </p>
      </div>

      {categories.map((category) => (
        <section key={category} className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{CATEGORY_LABELS[category]}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ALL_FIXTURES.filter((f) => f.category === category).map((fixture) => (
              <Card key={fixture.id}>
                <CardHeader>
                  <CardTitle>{fixture.label}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <p className="text-muted-foreground">{fixture.description}</p>
                  <div className="flex flex-col gap-1 rounded-md bg-muted p-2 font-mono text-xs">
                    <span>{fixture.magicValue}</span>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    {fixture.expectedOutcome}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
