"use client";

import { ACCOUNT_TYPES, type AccountType } from "@/lib/providers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LABELS: Record<AccountType, string> = {
  WALLET: "Wallet",
  SAVINGS: "Savings",
  CURRENT: "Current",
  MERCHANT_TILL: "Merchant till",
};

export function AccountTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: AccountType | null;
  onChange: (value: AccountType) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AccountType)} disabled={disabled}>
      <SelectTrigger aria-label="Account type">
        <SelectValue placeholder="Account type" />
      </SelectTrigger>
      <SelectContent>
        {ACCOUNT_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {LABELS[type]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
