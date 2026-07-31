"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MnoSelector } from "./mno-selector";
import { AmountHint } from "@/components/ui/amount-hint";
import { TransactionMonitor } from "./transaction-monitor";
import { CORRIDORS, MARKET_STATUS_META, formatCurrency } from "@/lib/corridors";
import { isTerminalState, type LifecycleState } from "@/lib/lifecycle";

import { DEMO_AUTH_HEADERS as AUTH_HEADERS } from "@/lib/sandbox/demo-key";
import { describePaymentOutcome } from "@/lib/sandbox/demo-response";
const fetcher = (url: string) => fetch(url, { headers: AUTH_HEADERS }).then((r) => r.json());

const MAGIC_QUOTE_IDS = [
  { id: "hsc_quote_expired", label: "Expired quote" },
  { id: "hsc_quote_adverse", label: "Adverse rate move" },
  { id: "hsc_quote_illiquid", label: "Liquidity exhausted" },
  { id: "hsc_quote_after_cutoff", label: "After cut-off" },
] as const;

interface QuoteResponse {
  quoteId: string;
  corridorId: string;
  fromCurrency: string;
  toCurrency: string;
  amountMinor: string;
  midRateNumerator: string;
  midRateDenominator: string;
  creditedMinor: string;
  spreadBps: number;
  issuedAt: string;
  expiresAt: string;
}

/** Second wedge path: cross-border corridor settlement. Exercises the FX quote lifecycle and the four corridor failure fixtures. */
export function CrossBorderPanel() {
  const [corridorId, setCorridorId] = useState(CORRIDORS[0]!.id);
  const [sourceProvider, setSourceProvider] = useState<string | null>(null);
  const [destProvider, setDestProvider] = useState<string | null>(null);
  const [sourceMsisdn, setSourceMsisdn] = useState("");
  const [destMsisdn, setDestMsisdn] = useState("");
  const [amount, setAmount] = useState("1000000");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const corridor = CORRIDORS.find((c) => c.id === corridorId)!;

  const { data: status } = useSWR<{ status: LifecycleState; error?: { code: string; message: string } }>(
    transactionId ? `/api/v1/sandbox/payments?transactionId=${transactionId}` : null,
    fetcher,
    { refreshInterval: (latest) => (latest && (latest.error || isTerminalState(latest.status)) ? 0 : 2000) },
  );

  useEffect(() => {
    if (!quote) return;
    const tick = () => setRemainingSeconds(Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quote]);

  async function getQuote() {
    setQuoting(true);
    setQuote(null);
    try {
      const res = await fetch("/api/v1/sandbox/fx-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({ corridorId, amountMinor: amount }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to get quote");
        return;
      }
      setQuote(json);
      setQuoteId(json.quoteId);
    } finally {
      setQuoting(false);
    }
  }

  async function submit() {
    if (!quoteId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/sandbox/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({
          channel: "CROSS_BORDER",
          amountMinor: amount,
          currency: corridor.fromCurrency,
          destinationCurrency: corridor.toCurrency,
          market: corridor.from,
          quoteId,
          source: { providerCode: sourceProvider, accountType: "WALLET", identifier: sourceMsisdn },
          destination: { providerCode: destProvider, accountType: "WALLET", identifier: destMsisdn },
          reference: `xborder-demo-${Date.now()}`,
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

  const midRate = quote ? Number(quote.midRateNumerator) / Number(quote.midRateDenominator) : null;
  const customerRate = quote ? midRate! * (1 - quote.spreadBps / 10_000) : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Cross-border corridor <Badge variant="sandbox">sandbox</Badge>
        </CardTitle>
        <CardDescription>The second wedge call: quote, then settle. Try the magic quoteIds below to force each failure fixture.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Corridor</Label>
          <Select value={corridorId} onValueChange={(v) => { setCorridorId(v as string); setQuote(null); setQuoteId(null); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CORRIDORS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {MARKET_STATUS_META[c.from].label} &rarr; {MARKET_STATUS_META[c.to].label} ({c.fromCurrency}&rarr;{c.toCurrency})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Amount (minor units, {corridor.fromCurrency})</Label>
          <Input value={amount} onChange={(e) => { setAmount(e.target.value); setQuote(null); setQuoteId(null); }} />
          <AmountHint amountMinor={amount} currency={corridor.fromCurrency} />
        </div>
        <Button variant="outline" onClick={getQuote} disabled={quoting || !amount}>
          {quoting ? "Quoting…" : "Get FX quote"}
        </Button>

        {quote && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mid rate</span>
              <span>1 {quote.fromCurrency} = {midRate!.toFixed(6)} {quote.toCurrency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Spread</span>
              <span>{quote.spreadBps} bps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer rate</span>
              <span>1 {quote.fromCurrency} = {customerRate!.toFixed(6)} {quote.toCurrency}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Credited</span>
              <span>{formatCurrency(BigInt(quote.creditedMinor), quote.toCurrency as "TZS" | "KES" | "UGX" | "RWF")}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Quote {quoteId === quote.quoteId ? "expires" : "overridden"}</span>
              <span>{quoteId === quote.quoteId ? `${remainingSeconds}s` : quoteId}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Force a corridor failure fixture (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {MAGIC_QUOTE_IDS.map((m) => (
              <Button key={m.id} type="button" size="sm" variant={quoteId === m.id ? "sandbox" : "outline"} onClick={() => setQuoteId(m.id)}>
                {m.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Source wallet ({MARKET_STATUS_META[corridor.from].label})</Label>
          <MnoSelector value={sourceProvider} onChange={setSourceProvider} />
          <Input placeholder="Source MSISDN" value={sourceMsisdn} onChange={(e) => setSourceMsisdn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Destination wallet</Label>
          <MnoSelector value={destProvider} onChange={setDestProvider} />
          <Input placeholder="Destination MSISDN" value={destMsisdn} onChange={(e) => setDestMsisdn(e.target.value)} />
        </div>

        <Button onClick={submit} disabled={submitting || !quoteId || !sourceProvider || !destProvider}>
          Initiate cross-border payment
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
