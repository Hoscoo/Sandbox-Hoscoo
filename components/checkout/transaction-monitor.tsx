import { Badge } from "@/components/ui/badge";
import { LIFECYCLE_STATES, type LifecycleState } from "@/lib/lifecycle";

const STATE_VARIANT: Record<LifecycleState, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  PENDING_AUTHORIZATION: "secondary",
  AUTHORIZED: "default",
  ROUTING: "default",
  SETTLING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
  EXPIRED: "destructive",
};

export function TransactionMonitor({ state }: { state: LifecycleState }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {LIFECYCLE_STATES.filter((s) => s !== "FAILED" && s !== "EXPIRED").map((s, i, arr) => (
        <div key={s} className="flex items-center gap-2">
          <Badge variant={s === state ? STATE_VARIANT[s] : "outline"}>{s}</Badge>
          {i < arr.length - 1 && <span className="text-muted-foreground">&rarr;</span>}
        </div>
      ))}
      {(state === "FAILED" || state === "EXPIRED") && (
        <>
          <span className="text-muted-foreground">&rarr;</span>
          <Badge variant={STATE_VARIANT[state]}>{state}</Badge>
        </>
      )}
    </div>
  );
}
