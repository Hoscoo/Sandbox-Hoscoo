"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LIFECYCLE_STATES } from "@/lib/lifecycle";
import { ERROR_CODES } from "@/lib/errors";

import { DEMO_AUTH_HEADERS as AUTH_HEADERS } from "@/lib/sandbox/demo-key";
const fetcher = (url: string) => fetch(url, { headers: AUTH_HEADERS }).then((r) => r.json());

const SCOPE_TYPES = ["NEXT_CALL", "PER_KEY", "PER_ACCOUNT"] as const;
const OUTCOME_KINDS = ["LIFECYCLE_STATE", "THREE_DS_CHALLENGE", "THREE_DS_FAILURE", "DEBIT_SUCCEEDED_CREDIT_FAILED", "RAIL_UNAVAILABLE"] as const;

/** Registers/lists/clears programmable simulation rules — the secondary outcome-control mechanism after magic values (lib/sandbox/simulation.ts). */
export function SimulationConsole() {
  const [scopeType, setScopeType] = useState<(typeof SCOPE_TYPES)[number]>("NEXT_CALL");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [outcomeKind, setOutcomeKind] = useState<(typeof OUTCOME_KINDS)[number]>("LIFECYCLE_STATE");
  const [lifecycleState, setLifecycleState] = useState<string>("FAILED");
  const [reasonCode, setReasonCode] = useState<string>("TIMEOUT");
  const [providerCode, setProviderCode] = useState("MPESA_TZ");
  const [submitting, setSubmitting] = useState(false);

  const { data, mutate } = useSWR<{ rules: Array<{ id: string; scope: { type: string }; outcome: { kind: string } }> }>(
    "/api/v1/sandbox/simulate",
    fetcher,
  );

  async function registerRule() {
    setSubmitting(true);
    try {
      const scope = scopeType === "PER_ACCOUNT" ? { type: scopeType, identifier: accountIdentifier } : { type: scopeType };
      const outcome =
        outcomeKind === "LIFECYCLE_STATE"
          ? { kind: outcomeKind, state: lifecycleState, reasonCode: reasonCode || undefined }
          : outcomeKind === "RAIL_UNAVAILABLE"
            ? { kind: outcomeKind, providerCode }
            : { kind: outcomeKind };

      const res = await fetch("/api/v1/sandbox/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({ scope, outcome }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to register rule");
        return;
      }
      toast.success("Rule registered");
      await mutate();
    } finally {
      setSubmitting(false);
    }
  }

  async function clearRules() {
    const res = await fetch("/api/v1/sandbox/simulate", { method: "DELETE", headers: AUTH_HEADERS });
    if (res.ok) {
      toast.success("Rules cleared");
      await mutate();
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Simulation rules <Badge variant="sandbox">sandbox</Badge>
        </CardTitle>
        <CardDescription>Scoped to this demo key. Precedence: header directive &gt; rule &gt; magic value.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Scope</Label>
          <Select value={scopeType} onValueChange={(v) => setScopeType(v as (typeof SCOPE_TYPES)[number])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scopeType === "PER_ACCOUNT" && (
            <Input placeholder="Account identifier (destination MSISDN)" value={accountIdentifier} onChange={(e) => setAccountIdentifier(e.target.value)} />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Forced outcome</Label>
          <Select value={outcomeKind} onValueChange={(v) => setOutcomeKind(v as (typeof OUTCOME_KINDS)[number])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {outcomeKind === "LIFECYCLE_STATE" && (
            <div className="flex gap-2">
              <Select value={lifecycleState} onValueChange={(v) => setLifecycleState((v as string) ?? "FAILED")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={reasonCode} onValueChange={(v) => setReasonCode((v as string) ?? "TIMEOUT")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ERROR_CODES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {outcomeKind === "RAIL_UNAVAILABLE" && <Input placeholder="Provider code" value={providerCode} onChange={(e) => setProviderCode(e.target.value)} />}
        </div>

        <div className="flex gap-2">
          <Button onClick={registerRule} disabled={submitting} className="flex-1">
            Register rule
          </Button>
          <Button onClick={clearRules} variant="outline">
            Clear all
          </Button>
        </div>

        {data && data.rules.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-muted p-2 text-xs">
            {data.rules.map((r) => (
              <div key={r.id} className="flex justify-between">
                <span>{r.scope.type}</span>
                <span className="text-muted-foreground">{r.outcome.kind}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
