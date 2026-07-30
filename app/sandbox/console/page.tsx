import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { CrossBorderPanel } from "@/components/checkout/cross-border-panel";
import { BankPanel } from "@/components/checkout/bank-panel";
import { GatewayPanel } from "@/components/checkout/gateway-panel";
import { SimulationConsole } from "@/components/sandbox/simulation-console";
import { WebhookConsole } from "@/components/sandbox/webhook-console";
import { KeyManager } from "@/components/sandbox/key-manager";

export default function SandboxConsolePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Badge variant="sandbox">Sandbox</Badge>
        <h1 className="text-2xl font-semibold">Sandbox console</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Every channel, plus simulation rules, webhooks, and key issuance — all live against{" "}
          <code className="rounded bg-muted px-1 py-0.5">/api/v1/sandbox/*</code>. Every panel shares one demo API
          key so a payment made in one tab shows up in the webhook log.
        </p>
      </div>

      <Tabs defaultValue="wallet" className="flex w-full flex-col items-center gap-4">
        <TabsList>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="cross-border">Cross-border</TabsTrigger>
          <TabsTrigger value="bank">Bank</TabsTrigger>
          <TabsTrigger value="card">Card</TabsTrigger>
          <TabsTrigger value="simulate">Simulate</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="wallet" className="flex w-full justify-center">
          <CheckoutPanel />
        </TabsContent>
        <TabsContent value="cross-border" className="flex w-full justify-center">
          <CrossBorderPanel />
        </TabsContent>
        <TabsContent value="bank" className="flex w-full justify-center">
          <BankPanel />
        </TabsContent>
        <TabsContent value="card" className="flex w-full justify-center">
          <GatewayPanel />
        </TabsContent>
        <TabsContent value="simulate" className="flex w-full justify-center">
          <SimulationConsole />
        </TabsContent>
        <TabsContent value="webhooks" className="flex w-full justify-center">
          <WebhookConsole />
        </TabsContent>
        <TabsContent value="keys" className="flex w-full justify-center">
          <KeyManager />
        </TabsContent>
      </Tabs>
    </main>
  );
}
