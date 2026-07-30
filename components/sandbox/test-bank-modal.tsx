"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ProviderMark } from "@/components/checkout/provider-mark";
import type { MnoProvider } from "@/lib/providers";
import { formatCurrency, type CurrencyCode } from "@/lib/corridors";
import type { SdkMode, FxQuoteResult } from "@/lib/sdk/client";

type AuthVariant = "ussd" | "app_push" | "agent_assisted";

/** Driven by provider capability data, never hardcoded per provider — a seventh wallet provider needs no new variant. */
function authVariantFor(provider: MnoProvider): AuthVariant {
  if (provider.capabilities.ussdPush) return "ussd";
  if (provider.capabilities.appPush) return "app_push";
  return "agent_assisted";
}

export interface TestBankModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Structural guarantee: this component refuses to render authorization UI unless mode === 'sandbox', regardless of what a caller passes. */
  mode: SdkMode;
  provider: MnoProvider;
  amountMinor: bigint;
  currency: CurrencyCode;
  crossBorder?: { quote: FxQuoteResult; destinationCurrency: CurrencyCode };
  onAuthorize: (result: "approved" | "denied") => void;
}

export function TestBankModal({ open, onOpenChange, mode, provider, amountMinor, currency, crossBorder, onAuthorize }: TestBankModalProps) {
  const [pin, setPin] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!crossBorder) return;
    const tick = () => {
      const ms = new Date(crossBorder.quote.expiresAt).getTime() - Date.now();
      setRemainingSeconds(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [crossBorder]);

  if (mode !== "sandbox") {
    if (process.env.NODE_ENV !== "production") {
      console.error("TestBankModal was rendered with mode !== 'sandbox'. Refusing to render — this component never authorizes against a live key.");
    }
    return null;
  }

  const variant = authVariantFor(provider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 border-sandbox-border">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="sandbox">SANDBOX — Test Bank</Badge>
          </div>
          <DialogTitle className="flex items-center gap-2">
            <ProviderMark provider={provider} />
          </DialogTitle>
          <DialogDescription>
            No real money moves. This authorization screen simulates {provider.displayName}&apos;s{" "}
            {variant === "ussd" ? "USSD PIN prompt" : variant === "app_push" ? "in-app push approval" : "agent-assisted confirmation"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatCurrency(amountMinor, currency)}</span>
            </div>
          </div>

          {crossBorder && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mid rate</span>
                {/* Display-only ratio for a human-readable label — not a money computation, so Number() here does not violate the no-float money rule. */}
                <span>
                  1 {crossBorder.quote.fromCurrency} = {(Number(crossBorder.quote.midRateNumerator) / Number(crossBorder.quote.midRateDenominator)).toFixed(6)}{" "}
                  {crossBorder.quote.toCurrency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spread</span>
                <span>{crossBorder.quote.spreadBps} bps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer rate</span>
                <span>
                  1 {crossBorder.quote.fromCurrency} ={" "}
                  {((Number(crossBorder.quote.midRateNumerator) / Number(crossBorder.quote.midRateDenominator)) * (1 - crossBorder.quote.spreadBps / 10_000)).toFixed(6)}{" "}
                  {crossBorder.quote.toCurrency}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span>You&apos;ll receive</span>
                <span>{formatCurrency(BigInt(crossBorder.quote.creditedMinor), crossBorder.destinationCurrency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Quote expires</span>
                <span>{remainingSeconds !== null ? `${remainingSeconds}s` : "—"}</span>
              </div>
            </div>
          )}

          {variant === "ussd" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Enter the 4-digit sandbox PIN sent via simulated USSD.</p>
              <Input inputMode="numeric" maxLength={4} placeholder="0000" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}

          {variant === "app_push" && (
            <p className="text-sm text-muted-foreground">
              A push notification was sent to the {provider.displayName} test app. Approve or deny it below to simulate the customer's response.
            </p>
          )}

          {variant === "agent_assisted" && (
            <p className="text-sm text-muted-foreground">
              Simulates the customer completing this transaction with a {provider.displayName} agent using confirmation code{" "}
              <span className="font-mono">SBX-{pin || "0000"}</span>.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="sandbox" className="flex-1" onClick={() => onAuthorize("approved")}>
              Approve
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onAuthorize("denied")}>
              Deny
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
