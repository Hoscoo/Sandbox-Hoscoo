/**
 * Simulated TIPS (Tanzania Instant Payment System) alias directory. Resolves
 * a bank-alias (typically an MSISDN or national ID) to the destination bank
 * account for BANK_TO_BANK instructions, standing in for a call to the real
 * national switch.
 */
import type { BankProvider } from "./providers";
import { BANKS } from "./providers";

export interface TipsAliasRecord {
  alias: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

const DIRECTORY: TipsAliasRecord[] = [
  { alias: "+255700000001", bankCode: "CRDB", accountNumber: "0150000000001", accountName: "Amina Juma" },
  { alias: "+255700000002", bankCode: "NMB", accountNumber: "0220000000002", accountName: "Baraka Mushi" },
  { alias: "+255700000003", bankCode: "NBC", accountNumber: "0330000000003", accountName: "Grace Mollel" },
  { alias: "+255700000004", bankCode: "STANBIC_TZ", accountNumber: "0440000000004", accountName: "Hoscoo Test Merchant" },
];

export function resolveTipsAlias(alias: string): { record: TipsAliasRecord; bank: BankProvider } | undefined {
  const record = DIRECTORY.find((r) => r.alias === alias);
  if (!record) return undefined;
  const bank = BANKS.find((b) => b.code === record.bankCode);
  if (!bank || !bank.supportsTips) return undefined;
  return { record, bank };
}
