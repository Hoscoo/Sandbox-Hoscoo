"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BankSelector } from "./bank-selector";
import { TransactionMonitor } from "./transaction-monitor";
import { GATEWAY_PROVIDERS, detectCardScheme, isValidCardNumber, formatCardNumber } from "@/lib/providers";
import type { LifecycleState } from "@/lib/lifecycle";

import { DEMO_AUTH_HEADERS as AUTH_HEADERS } from "@/lib/sandbox/demo-key";
const fetcher = (url: string) => fetch(url, { headers: AUTH_HEADERS }).then((r) => r.json());

const CARD_FIXTURES = [
  { pan: "4242424242424242", label: "Success" },
  { pan: "4000000000003220", label: "3-DS challenge" },
  { pan: "4000000000003063", label: "3-DS failure" },
  { pan: "4000000000009995", label: "Insufficient funds" },
];

export function GatewayPanel() {
  const [gatewayProvider, setGatewayProvider] = useState<string | null>(GATEWAY_PROVIDERS[0]!.code);
  const [merchantBank, setMerchantBank] = useState<string | null>(null);
  const [merchantAccount, setMerchantAccount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const scheme = useMemo(() => detectCardScheme(cardNumber), [cardNumber]);
  const valid = useMemo(() => (cardNumber ? isValidCardNumber(cardNumber) : null), [cardNumber]);

  const { data: status } = useSWR<{ status: LifecycleState }>(
    transactionId ? `/api/v1/sandbox/payments?transactionId=${transactionId}` : null,
    fetcher,
    { refreshInterval: 2000 },
  );

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/sandbox/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({
          channel: "GATEWAY_CHECKOUT",
          amountMinor: amount,
          currency: "TZS",
          market: "TZ",
          source: { providerCode: gatewayProvider, accountType: "WALLET", identifier: cardNumber.replace(/\s/g, "") },
          destination: { providerCode: merchantBank, accountType: "MERCHANT_TILL", identifier: merchantAccount },
          reference: `card-demo-${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Card checkout failed");
        return;
      }
      setTransactionId(json.transactionId);
      toast.success("Card checkout initiated");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Card checkout <Badge variant="sandbox">sandbox</Badge>
        </CardTitle>
        <CardDescription>No real card data is ever sent anywhere real — this posts straight to the mock ledger.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Gateway provider</Label>
          <Select value={gatewayProvider} onValueChange={(v) => setGatewayProvider(v as string)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GATEWAY_PROVIDERS.map((g) => (
                <SelectItem key={g.code} value={g.code}>
                  {g.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Card number</Label>
          <Input placeholder="4242 4242 4242 4242" value={formatCardNumber(cardNumber)} onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, ""))} />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {scheme && <Badge variant="outline">{scheme.displayName}</Badge>}
            {valid !== null && <Badge variant={valid ? "success" : "destructive"}>{valid ? "Luhn valid" : "Luhn invalid"}</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            {CARD_FIXTURES.map((f) => (
              <Button key={f.pan} type="button" size="sm" variant="outline" onClick={() => setCardNumber(f.pan)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Settling merchant bank</Label>
          <BankSelector value={merchantBank} onChange={setMerchantBank} />
          <Input placeholder="Merchant till / account number" value={merchantAccount} onChange={(e) => setMerchantAccount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Amount (minor units, TZS)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={submitting || !gatewayProvider || !merchantBank || !cardNumber || !amount}>
          Initiate card checkout
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
