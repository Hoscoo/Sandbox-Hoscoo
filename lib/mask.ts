/** Shared PII masking — used by the SDK (never log PAN/PIN/full MSISDN client-side) and the webhook delivery inspector. */

export function maskMsisdn(msisdn: string): string {
  const digits = msisdn.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  const prefixLen = msisdn.length - digits.length;
  return `${msisdn.slice(0, prefixLen)}${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function maskPan(pan: string): string {
  const digits = pan.replace(/\D/g, "");
  if (digits.length < 10) return "*".repeat(digits.length);
  return `${digits.slice(0, 6)}${"*".repeat(digits.length - 10)}${digits.slice(-4)}`;
}
