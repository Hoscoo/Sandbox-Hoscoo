import { formatCurrency, type CurrencyCode } from "@/lib/corridors";

/** Live "≈ TSh 5,000.00" readout under a raw minor-units amount input, so a large figure is countable at a glance. */
export function AmountHint({ amountMinor, currency }: { amountMinor: string; currency: CurrencyCode }) {
  if (!/^[0-9]+$/.test(amountMinor)) return null;
  return <span className="text-xs text-muted-foreground">&asymp; {formatCurrency(BigInt(amountMinor), currency)}</span>;
}
