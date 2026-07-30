"use client";

import { BANKS } from "@/lib/providers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function BankSelector({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (providerCode: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)} disabled={disabled}>
      <SelectTrigger aria-label="Bank">
        <SelectValue placeholder="Select bank" />
      </SelectTrigger>
      <SelectContent>
        {BANKS.map((bank) => (
          <SelectItem key={bank.code} value={bank.code}>
            {bank.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
