"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { BankSelector } from "./bank-selector";
import { TransactionMonitor } from "./transaction-monitor";
import { isTerminalState, type LifecycleState } from "@/lib/lifecycle";

import { DEMO_AUTH_HEADERS as AUTH_HEADERS } from "@/lib/sandbox/demo-key";
import { describePaymentOutcome } from "@/lib/sandbox/demo-response";
const fetcher = (url: string) => fetch(url, { headers: AUTH_HEADERS }).then((r) => r.json());

const TIPS_ALIAS_FIXTURES = [
  { alias: "+255700000001", label: "CRDB alias — resolves" },
  { alias: "+255700099999", label: "Unmapped alias — fails" },
];

/** BANK_TO_BANK via the simulated TIPS alias directory (lib/tips.ts). */
export function BankPanel() {
  const [sourceBank, setSourceBank] = useState<string | null>(null);
  const [sourceAccount, setSourceAccount] = useState("");
  const [destBank, setDestBank] = useState<string | null>("CRDB");
  const [destAlias, setDestAlias] = useState("+255700000001");
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: status } = useSWR<{ status: LifecycleState; error?: { code: string; message: string } }>(
    transactionId ? `/api/v1/sandbox/payments?transactionId=${transactionId}` : null,
    fetcher,
    // Stop polling on a terminal status OR an error response (e.g. a 404 for
    // a transactionId the in-memory store no longer has) — otherwise a
    // lookup that will never succeed polls forever.
    { refreshInterval: (latest) => (latest && (latest.error || isTerminalState(latest.status)) ? 0 : 2000) },
  );

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/sandbox/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({
          channel: "BANK_TO_BANK",
          amountMinor: amount,
          currency: "TZS",
          market: "TZ",
          source: { providerCode: sourceBank, accountType: "CURRENT", identifier: sourceAccount },
          destination: { providerCode: destBank, accountType: "CURRENT", identifier: destAlias },
          reference: `bank-demo-${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (json.transactionId) setTransactionId(json.transactionId);
      const outcome = describePaymentOutcome(json);
      toast[outcome.type](outcome.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Bank to bank <Badge variant="sandbox">sandbox</Badge>
        </CardTitle>
        <CardDescription>Resolves via the simulated TIPS alias directory (lib/tips.ts).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Source bank</Label>
          <BankSelector value={sourceBank} onChange={setSourceBank} />
          <Input placeholder="Source account number" value={sourceAccount} onChange={(e) => setSourceAccount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Destination bank</Label>
          <BankSelector value={destBank} onChange={setDestBank} />
          <Input placeholder="Destination TIPS alias" value={destAlias} onChange={(e) => setDestAlias(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {TIPS_ALIAS_FIXTURES.map((f) => (
              <Button key={f.alias} type="button" size="sm" variant="outline" onClick={() => setDestAlias(f.alias)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Amount (minor units, TZS)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={submitting || !sourceBank || !destBank || !amount}>
          Initiate bank transfer
        </Button>
        {transactionId && (
          <>
            <Separator />
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-muted-foreground">{transactionId}</span>
              <TransactionMonitor state={status?.status ?? "PENDING_AUTHORIZATION"} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
