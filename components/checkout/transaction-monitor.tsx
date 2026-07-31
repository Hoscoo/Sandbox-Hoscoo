import { Badge } from "@/components/ui/badge";
import { LIFECYCLE_STATES, isTerminalState, type LifecycleState } from "@/lib/lifecycle";

const STATE_VARIANT: Record<LifecycleState, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  PENDING_AUTHORIZATION: "secondary",
  AUTHORIZED: "default",
  ROUTING: "default",
  SETTLING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
  EXPIRED: "destructive",
};

// COMPLETED, FAILED, and EXPIRED are mutually exclusive branches out of
// SETTLING/AUTHORIZED/ROUTING — never a sequential "completed, then failed"
// chain — so at most one of them renders, and only once the transaction has
// actually reached it.
const NON_TERMINAL_STATES = LIFECYCLE_STATES.filter((s) => !isTerminalState(s));

export function TransactionMonitor({ state }: { state: LifecycleState }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {NON_TERMINAL_STATES.map((s) => (
        <div key={s} className="flex items-center gap-2">
          <Badge variant={s === state ? STATE_VARIANT[s] : "outline"}>{s}</Badge>
          <span className="text-muted-foreground">&rarr;</span>
        </div>
      ))}
      {isTerminalState(state) ? <Badge variant={STATE_VARIANT[state]}>{state}</Badge> : <span className="text-muted-foreground">&hellip;</span>}
    </div>
  );
}
