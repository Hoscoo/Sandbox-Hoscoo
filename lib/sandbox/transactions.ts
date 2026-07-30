/** Sandbox transaction records, scoped per API key. Same in-memory durability caveat as lib/sandbox/store.ts. */
import type { PaymentInstruction } from "../validation";
import type { LifecycleState } from "../lifecycle";
import type { Rail } from "../corridors";
import type { ErrorCode } from "../errors";

export interface SandboxTransaction {
  transactionId: string;
  apiKey: string;
  instruction: PaymentInstruction;
  state: LifecycleState;
  reasonCode?: ErrorCode;
  rail: Rail | null;
  quoteId?: string;
  requiresAction?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORE = new Map<string, SandboxTransaction>();

export function putSandboxTransaction(tx: SandboxTransaction): void {
  STORE.set(tx.transactionId, tx);
}

export function getSandboxTransaction(transactionId: string): SandboxTransaction | undefined {
  return STORE.get(transactionId);
}

export function listSandboxTransactions(apiKey: string): SandboxTransaction[] {
  return Array.from(STORE.values()).filter((t) => t.apiKey === apiKey);
}
