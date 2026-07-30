"use client";

import { useMemo, useState } from "react";
import { CHANNELS, CHANNEL_META, CHANNEL_RAILS } from "@/lib/providers";
import { selectRoute, formatCurrency, type Rail, type RailHealth } from "@/lib/corridors";
import type { Channel } from "@/lib/providers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function allHealthy(rails: Rail[]): Record<Rail, RailHealth> {
  return Object.fromEntries(rails.map((r) => [r, "HEALTHY" as RailHealth])) as Record<Rail, RailHealth>;
}

/** Live demo of the exact selectRoute() production/sandbox both call — not a mocked-up preview. */
export function RouteOptimizer() {
  const [channel, setChannel] = useState<Channel>("MNO_TO_MNO");
  const [amount, setAmount] = useState("500000");

  const decision = useMemo(() => {
    const amountMinor = /^[0-9]+$/.test(amount) ? BigInt(amount) : 0n;
    const candidateRails = CHANNEL_RAILS[channel];
    return selectRoute({
      market: "TZ",
      amountMinor,
      minAmountMinor: 1n,
      maxAmountMinor: 999_999_999_999n,
      candidateRails,
      railHealth: allHealthy(candidateRails),
    });
  }, [channel, amount]);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-12">
      <div>
        <h2 className="text-xl font-semibold">Route optimizer</h2>
        <p className="text-sm text-muted-foreground">Pick a channel and amount — this calls the real selectRoute().</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Try it</CardTitle>
          <CardDescription>Market: Tanzania (TZ)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANNEL_META[c].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Amount (minor units)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
            {decision.candidates.map((c) => (
              <div key={c.rail} className="flex items-center justify-between">
                <span>{c.rail}</span>
                <div className="flex items-center gap-2">
                  {c.costMinor !== null && <span className="text-muted-foreground">{formatCurrency(c.costMinor, "TZS")}</span>}
                  <Badge variant={c.status === "ELIGIBLE" ? (decision.selected?.rail === c.rail ? "success" : "outline") : "destructive"}>
                    {decision.selected?.rail === c.rail ? "selected" : c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
