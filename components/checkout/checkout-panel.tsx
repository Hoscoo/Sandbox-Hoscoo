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
import { MnoSelector } from "./mno-selector";
import { AccountTypeSelector } from "./account-type-selector";
import { TransactionMonitor } from "./transaction-monitor";
import { TestBankModal } from "@/components/sandbox/test-bank-modal";
import { MNOS, type AccountType } from "@/lib/providers";
import { isTerminalState, type LifecycleState } from "@/lib/lifecycle";

import { DEMO_AUTH_HEADERS as AUTH_HEADERS } from "@/lib/sandbox/demo-key";
import { describePaymentOutcome } from "@/lib/sandbox/demo-response";

interface PaymentStatusResponse {
  transactionId: string;
  status: LifecycleState;
  requiresAction: boolean;
  error?: { code: string; message: string };
}

const fetcher = (url: string) => fetch(url, { headers: AUTH_HEADERS }).then((r) => r.json());

/**
 * Live sandbox demo for the CROSS_MNO_TO_MNO wedge path: wallet-to-wallet,
 * same market, no FX. Talks to /api/v1/sandbox/* directly (not through
 * lib/sdk, which targets the external sandbox-api.hoscoo.com origin) so it
 * works against this same deployment's API routes in local dev and preview.
 */
export function CheckoutPanel() {
  const [sourceProvider, setSourceProvider] = useState<string | null>(null);
  const [destProvider, setDestProvider] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>("WALLET");
  const [sourceMsisdn, setSourceMsisdn] = useState("");
  const [destMsisdn, setDestMsisdn] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [resolvingChallenge, setResolvingChallenge] = useState(false);

  const { data: status, mutate: refreshStatus } = useSWR<PaymentStatusResponse>(
    transactionId ? `/api/v1/sandbox/payments?transactionId=${transactionId}` : null,
    fetcher,
    // Stop polling on a terminal status OR an error response (e.g. a 404 for
    // a transactionId the in-memory store no longer has) — otherwise this
    // polls forever, whether the payment finished or the lookup can never
    // succeed at all.
    { refreshInterval: (latest) => (latest && (latest.error || isTerminalState(latest.status)) ? 0 : 2000) },
  );

  const destinationProviderRecord = MNOS.find((m) => m.code === destProvider);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/sandbox/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({
          channel: "MNO_TO_MNO",
          amountMinor: amount,
          currency: "TZS",
          market: "TZ",
          source: { providerCode: sourceProvider, accountType, identifier: sourceMsisdn },
          destination: { providerCode: destProvider, accountType, identifier: destMsisdn },
          reference: `demo-${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (json.transactionId) setTransactionId(json.transactionId);
      const outcome = describePaymentOutcome(json);
      toast[outcome.type](outcome.message);
      if (json.requiresAction) setChallengeOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChallengeDecision(decision: "approved" | "denied") {
    if (!transactionId) return;
    setResolvingChallenge(true);
    try {
      const res = await fetch("/api/v1/sandbox/payments/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({ transactionId, decision }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to resolve challenge");
      } else {
        toast[json.status === "COMPLETED" ? "success" : "error"](`Challenge ${decision}: ${json.status}`);
      }
      setChallengeOpen(false);
      await refreshStatus();
    } finally {
      setResolvingChallenge(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Wallet to wallet <Badge variant="sandbox">sandbox</Badge>
        </CardTitle>
        <CardDescription>
          M-Pesa to Airtel Money, or any cross-network wallet pair. Try destination{" "}
          <code className="rounded bg-muted px-1 py-0.5">+255700000105</code> to trigger a 3-DS challenge.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Source wallet</Label>
          <MnoSelector value={sourceProvider} onChange={setSourceProvider} />
          <Input placeholder="Source MSISDN" value={sourceMsisdn} onChange={(e) => setSourceMsisdn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Destination wallet</Label>
          <MnoSelector value={destProvider} onChange={setDestProvider} />
          <Input placeholder="Destination MSISDN" value={destMsisdn} onChange={(e) => setDestMsisdn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Account type</Label>
          <AccountTypeSelector value={accountType} onChange={setAccountType} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Amount (minor units, TZS)</Label>
          <Input placeholder="e.g. 500000 = TSh 5,000.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={submitting || !sourceProvider || !destProvider || !amount}>
          Initiate payment
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

      {destinationProviderRecord && (
        <TestBankModal
          open={challengeOpen}
          onOpenChange={setChallengeOpen}
          mode="sandbox"
          provider={destinationProviderRecord}
          amountMinor={amount && /^\d+$/.test(amount) ? BigInt(amount) : 0n}
          currency="TZS"
          onAuthorize={(result) => {
            if (resolvingChallenge) return;
            void handleChallengeDecision(result === "approved" ? "approved" : "denied");
          }}
        />
      )}
    </Card>
  );
}
