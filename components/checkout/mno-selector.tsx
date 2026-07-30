"use client";

import { MNOS } from "@/lib/providers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** providerCode is the only value this component emits — never infer selection from MSISDN prefix. */
export function MnoSelector({
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
      <SelectTrigger aria-label="Wallet provider">
        <SelectValue placeholder="Select wallet provider" />
      </SelectTrigger>
      <SelectContent>
        {MNOS.map((mno) => (
          <SelectItem key={mno.code} value={mno.code}>
            {mno.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
