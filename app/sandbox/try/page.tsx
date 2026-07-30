import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { Badge } from "@/components/ui/badge";

export default function TrySandboxPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Badge variant="sandbox">Sandbox</Badge>
        <h1 className="text-2xl font-semibold">Try the wedge path live</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This form calls the real <code className="rounded bg-muted px-1 py-0.5">/api/v1/sandbox/payments</code>{" "}
          route against the deterministic mock ledger. No real money moves.
        </p>
      </div>
      <CheckoutPanel />
    </main>
  );
}
