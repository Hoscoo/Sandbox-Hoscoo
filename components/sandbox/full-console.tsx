import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { CrossBorderPanel } from "@/components/checkout/cross-border-panel";
import { BankPanel } from "@/components/checkout/bank-panel";
import { GatewayPanel } from "@/components/checkout/gateway-panel";
import { SimulationConsole } from "@/components/sandbox/simulation-console";
import { WebhookConsole } from "@/components/sandbox/webhook-console";
import { KeyManager } from "@/components/sandbox/key-manager";

/**
 * Every channel plus simulation rules, webhooks, and key issuance, all live
 * against /api/v1/sandbox/*. Shared by app/sandbox/try (the primary "try it
 * live" entry point) so there is exactly one implementation of the full
 * console, not two pages that drift from each other.
 */
export function FullConsole() {
  return (
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
  );
}
