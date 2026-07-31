import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ApiReference, type ApiReferenceEndpoint } from "@/components/api-reference";

const ENDPOINTS: ApiReferenceEndpoint[] = [
  {
    method: "POST",
    path: "/v1/sandbox/payments",
    summary: "The first-call integration path: a domestic CROSS_MNO_TO_MNO wallet-to-wallet payment. No bank fixture, no FX.",
    sandboxOnly: true,
    curl: `curl -X POST https://sandbox-api.hoscoo.com/v1/payments \\
  -H "Authorization: Bearer hsc_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "MNO_TO_MNO",
    "amountMinor": "500000",
    "currency": "TZS",
    "market": "TZ",
    "source": { "providerCode": "MPESA_TZ", "accountType": "WALLET", "identifier": "+255740000001" },
    "destination": { "providerCode": "AIRTEL_MONEY", "accountType": "WALLET", "identifier": "+255780000001" },
    "reference": "order-1001"
  }'`,
  },
  {
    method: "POST",
    path: "/v1/sandbox/fx-quote",
    summary: "Second call: quote a cross-border corridor before initiating a CROSS_BORDER instruction.",
    sandboxOnly: true,
    curl: `curl -X POST https://sandbox-api.hoscoo.com/v1/fx-quote \\
  -H "Authorization: Bearer hsc_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "corridorId": "TZ-KE", "amountMinor": "1000000" }'`,
  },
  {
    method: "POST",
    path: "/v1/sandbox/simulate",
    summary: "Register a programmable outcome rule scoped to this API key.",
    sandboxOnly: true,
    curl: `curl -X POST https://sandbox-api.hoscoo.com/v1/simulate \\
  -H "Authorization: Bearer hsc_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "scope": { "type": "NEXT_CALL" }, "outcome": { "kind": "LIFECYCLE_STATE", "state": "FAILED", "reasonCode": "TIMEOUT" } }'`,
  },
  {
    method: "POST",
    path: "/v1/sandbox/webhooks/replay",
    summary: "Re-deliver a stored event verbatim to exercise merchant idempotency logic.",
    sandboxOnly: true,
    curl: `curl -X POST https://sandbox-api.hoscoo.com/v1/webhooks/replay \\
  -H "Authorization: Bearer hsc_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "eventId": "hsc_evt_..." }'`,
  },
];

export default function SandboxPortalPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <Badge variant="sandbox" className="w-fit">
          Sandbox
        </Badge>
        <h1 className="text-2xl font-semibold">Hoscoo sandbox portal</h1>
        <p className="text-muted-foreground">
          Everything here runs against <code className="rounded bg-muted px-1 py-0.5">sandbox-api.hoscoo.com</code>{" "}
          with an <code className="rounded bg-muted px-1 py-0.5">hsc_test_</code> key. No sandbox call can reach a
          live rail or move real money.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/sandbox/try" className={buttonVariants({ variant: "default" })}>
            Try it live
          </Link>
          <a href="/openapi/v1.json" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            OpenAPI spec (v1)
          </a>
          <a
            href={`https://app.getpostman.com/run-collection/#?collection=${encodeURIComponent("/postman/hoscoo-sandbox.postman_collection.json")}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Run in Postman
          </a>
          <Link href="/sandbox/fixtures" className={buttonVariants({ variant: "outline" })}>
            Deterministic fixtures
          </Link>
        </div>
      </div>

      <ApiReference endpoints={ENDPOINTS} />
    </main>
  );
}
