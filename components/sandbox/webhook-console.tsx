"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DEMO_AUTH_HEADERS as AUTH_HEADERS } from "@/lib/sandbox/demo-key";

const fetcher = (url: string) => fetch(url, { headers: AUTH_HEADERS }).then((r) => r.json());

interface DeliveryLogEntry {
  id: string;
  eventId: string;
  eventType: string | null;
  attempt: number;
  httpStatus: number | null;
  error: string | null;
  sentAt: string;
  isReplay: boolean;
  payloadPreview: Record<string, unknown> | null;
}

/** Register a URL, trigger delivery, watch it land, replay it. The local echo endpoint makes this self-testable without an external URL. */
export function WebhookConsole() {
  const [url, setUrl] = useState("");
  const [registering, setRegistering] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const { data: logs, mutate: refreshLogs } = useSWR<{ logs: DeliveryLogEntry[] }>("/api/v1/sandbox/webhooks/logs", fetcher, { refreshInterval: 3000 });
  const { data: echoed, mutate: refreshEcho } = useSWR<{ received: Array<{ receivedAt: string; eventId: string | null; eventType: string | null; isReplay: string | null }> }>(
    "/api/v1/sandbox/webhooks/echo",
    (u: string) => fetch(u).then((r) => r.json()),
    { refreshInterval: 3000 },
  );

  function fillEchoUrl() {
    setUrl(`${window.location.origin}/api/v1/sandbox/webhooks/echo`);
  }

  async function register() {
    setRegistering(true);
    try {
      const res = await fetch("/api/v1/sandbox/webhooks", { method: "POST", headers: { "Content-Type": "application/json", ...AUTH_HEADERS }, body: JSON.stringify({ url }) });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to register webhook URL");
        return;
      }
      toast.success("Webhook URL registered");
    } finally {
      setRegistering(false);
    }
  }

  async function dispatchNow() {
    setDispatching(true);
    try {
      const res = await fetch("/api/v1/sandbox/webhooks/dispatch");
      const json = await res.json();
      toast.info(`Dispatched: ${json.delivered} delivered, ${json.attempted} attempted`);
      await Promise.all([refreshLogs(), refreshEcho()]);
    } finally {
      setDispatching(false);
    }
  }

  async function replay(eventId: string) {
    const res = await fetch("/api/v1/sandbox/webhooks/replay", { method: "POST", headers: { "Content-Type": "application/json", ...AUTH_HEADERS }, body: JSON.stringify({ eventId }) });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error?.message ?? "Replay failed");
      return;
    }
    toast.success("Replay queued — click \"Deliver now\" to send it");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Webhooks <Badge variant="sandbox">sandbox</Badge>
        </CardTitle>
        <CardDescription>Register a URL, run a payment elsewhere in this console, then deliver.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Webhook URL</Label>
          <div className="flex gap-2">
            <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button type="button" variant="outline" onClick={fillEchoUrl}>
              Use local echo
            </Button>
          </div>
          <Button onClick={register} disabled={registering || !url}>
            Register
          </Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={dispatchNow} disabled={dispatching} variant="outline" className="flex-1">
            Deliver now
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label>Delivery log (MSISDNs masked)</Label>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md bg-muted p-2 text-xs">
            {(!logs || logs.logs.length === 0) && <span className="text-muted-foreground">No deliveries yet.</span>}
            {logs?.logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {l.eventType} {l.isReplay && <Badge variant="outline">replay</Badge>}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={l.httpStatus && l.httpStatus < 400 ? "success" : "destructive"}>{l.httpStatus ?? l.error}</Badge>
                  <Button type="button" size="sm" variant="ghost" onClick={() => replay(l.eventId)}>
                    Replay
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Received at local echo endpoint</Label>
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-md bg-muted p-2 text-xs">
            {(!echoed || echoed.received.length === 0) && <span className="text-muted-foreground">Nothing received yet.</span>}
            {echoed?.received.map((r, i) => (
              <div key={i} className="flex justify-between">
                <span>{r.eventType}</span>
                <span className="text-muted-foreground">{r.isReplay === "true" ? "replay" : "original"}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
