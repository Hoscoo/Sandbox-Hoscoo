"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DEMO_AUTH_HEADERS as AUTH_HEADERS } from "@/lib/sandbox/demo-key";
import { formatCurrency, type CurrencyCode } from "@/lib/corridors";

interface IssuedKey {
  key: string;
  label: string;
  createdAt: string;
}

/** Issue a real key (lib/sandbox/keys.ts) and reset this demo tenant's mock ledger back to seeded balances. */
export function KeyManager() {
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [balances, setBalances] = useState<Record<string, string> | null>(null);

  async function issueKey() {
    setIssuing(true);
    try {
      const res = await fetch("/api/v1/sandbox/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "console demo" }) });
      const json = await res.json();
      setIssuedKey(json);
    } finally {
      setIssuing(false);
    }
  }

  async function resetLedger() {
    setResetting(true);
    try {
      const res = await fetch("/api/v1/sandbox/reset", { method: "POST", headers: AUTH_HEADERS });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Reset failed");
        return;
      }
      setBalances(json.balances);
      toast.success("Ledger reset to seeded balances");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Keys &amp; reset <Badge variant="sandbox">sandbox</Badge>
        </CardTitle>
        <CardDescription>Any hsc_test_ string works immediately — this is the recommended way to get a real one.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Button onClick={issueKey} disabled={issuing} variant="outline">
            Generate a real API key
          </Button>
          {issuedKey && (
            <code className="break-all rounded-md bg-muted p-2 text-xs">{issuedKey.key}</code>
          )}
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Button onClick={resetLedger} disabled={resetting} variant="destructive">
            Reset console demo key&apos;s ledger
          </Button>
          {balances && (
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-2 text-xs">
              {Object.entries(balances).map(([currency, amount]) => (
                <div key={currency} className="flex justify-between">
                  <span className="text-muted-foreground">{currency}</span>
                  <span>{formatCurrency(BigInt(amount), currency as CurrencyCode)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
