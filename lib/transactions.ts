/**
 * Production transaction state. In-memory today — this is the exact gap the
 * sandbox's SandboxStore/ledger work (lib/sandbox/store.ts) is architected to
 * eventually replace on the production side too. It is intentionally NOT
 * reused by the sandbox: sandbox lifecycle tests must be deterministic across
 * a serverless cold start, which an in-memory Map cannot provide. Until a
 * database is wired here, production and sandbox therefore use two different
 * state backends behind the same lifecycle/validation/signature contracts.
 */
import type { PaymentInstruction } from "./validation";
import type { LifecycleState } from "./lifecycle";
import type { Rail } from "./corridors";

export interface Transaction {
  transactionId: string;
  instruction: PaymentInstruction;
  state: LifecycleState;
  rail: Rail | null;
  signature: string;
  createdAt: string;
  updatedAt: string;
}

const STORE = new Map<string, Transaction>();

export function putTransaction(tx: Transaction): void {
  STORE.set(tx.transactionId, tx);
}

export function getTransaction(transactionId: string): Transaction | undefined {
  return STORE.get(transactionId);
}
