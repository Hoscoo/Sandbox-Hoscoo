import { Badge } from "@/components/ui/badge";
import { FullConsole } from "@/components/sandbox/full-console";

export default function TrySandboxPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Badge variant="sandbox">Sandbox</Badge>
        <h1 className="text-2xl font-semibold">Try it live</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Every channel — wallet, cross-border, bank, card — plus simulation rules, webhooks, and key issuance, all
          live against <code className="rounded bg-muted px-1 py-0.5">/api/v1/sandbox/*</code>. No real money moves.
          Every panel shares one demo API key, so a payment made in one tab shows up in the webhook log.
        </p>
      </div>
      <FullConsole />
    </main>
  );
}
