import { cn } from "@/lib/utils";
import type { ResolvedProvider } from "@/lib/providers";

/** Small identity chip shared across every selector — one place that renders a provider's display name + code. */
export function ProviderMark({ provider, className }: { provider: ResolvedProvider; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs", className)}>
      <span
        aria-hidden
        className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
      >
        {provider.displayName.slice(0, 1)}
      </span>
      <span className="font-medium">{provider.displayName}</span>
      <span className="text-muted-foreground">{provider.code}</span>
    </span>
  );
}
