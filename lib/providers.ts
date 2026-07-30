/**
 * Channel + participant registry. Data-driven by design: adding a seventh
 * wallet provider or a fifth market must only ever require new registry
 * entries here, never a change to validation, channel, or routing code.
 */
import { MARKET_STATUS_META, type Market, type Rail } from "./corridors";

// ---------------------------------------------------------------------------
// Legs and channels
// ---------------------------------------------------------------------------

export const LEG_KINDS = ["MNO", "BANK", "CARD"] as const;
export type LegKind = (typeof LEG_KINDS)[number];

export const CHANNELS = [
  "MNO_TO_MNO",
  "MNO_TO_BANK",
  "BANK_TO_MNO",
  "BANK_TO_BANK",
  "GATEWAY_CHECKOUT",
  "CROSS_BORDER",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LEGS: Record<Channel, { source: LegKind; destination: LegKind }> = {
  MNO_TO_MNO: { source: "MNO", destination: "MNO" },
  MNO_TO_BANK: { source: "MNO", destination: "BANK" },
  BANK_TO_MNO: { source: "BANK", destination: "MNO" },
  BANK_TO_BANK: { source: "BANK", destination: "BANK" },
  GATEWAY_CHECKOUT: { source: "CARD", destination: "BANK" },
  CROSS_BORDER: { source: "MNO", destination: "MNO" },
};

export const CHANNEL_META: Record<
  Channel,
  { label: string; description: string; crossNetwork: boolean; requiresFx: boolean }
> = {
  MNO_TO_MNO: {
    label: "Wallet to wallet",
    description: "Mobile money transfer between two wallet providers on the same market.",
    crossNetwork: true,
    requiresFx: false,
  },
  MNO_TO_BANK: {
    label: "Wallet to bank",
    description: "Mobile money wallet debits, settling into a bank account.",
    crossNetwork: true,
    requiresFx: false,
  },
  BANK_TO_MNO: {
    label: "Bank to wallet",
    description: "Bank account debits, settling into a mobile money wallet.",
    crossNetwork: true,
    requiresFx: false,
  },
  BANK_TO_BANK: {
    label: "Bank to bank",
    description: "Interbank transfer resolved via a TIPS-style alias directory.",
    crossNetwork: false,
    requiresFx: false,
  },
  GATEWAY_CHECKOUT: {
    label: "Card checkout",
    description: "Card-present or card-not-present acceptance via a payment gateway.",
    crossNetwork: false,
    requiresFx: false,
  },
  CROSS_BORDER: {
    label: "Cross-border corridor",
    description: "Cross-currency wallet payment routed through a settlement corridor.",
    crossNetwork: true,
    requiresFx: true,
  },
};

/**
 * The candidate rail(s) each channel routes over. Shared by production
 * (app/api/initiate-payment) and sandbox (app/api/v1/sandbox/payments) —
 * previously duplicated in both route files, which is exactly the kind of
 * drift this codebase can't tolerate.
 */
export const CHANNEL_RAILS: Record<Channel, Rail[]> = {
  MNO_TO_MNO: ["MNO_INTERCONNECT"],
  MNO_TO_BANK: ["MNO_INTERCONNECT"],
  BANK_TO_MNO: ["MNO_INTERCONNECT"],
  BANK_TO_BANK: ["TIPS"],
  GATEWAY_CHECKOUT: ["CARD_SCHEME"],
  CROSS_BORDER: ["CORRIDOR_SETTLEMENT"],
};

/** Channels whose two legs both carry a provider code that must be resolved against a registry. */
const CROSS_NETWORK_CHANNELS: ReadonlySet<Channel> = new Set(["MNO_TO_MNO", "MNO_TO_BANK", "BANK_TO_MNO"]);

/**
 * True when this specific instruction requires cross-network interop rather
 * than an on-us book transfer. A same-provider, same-leg-kind transfer
 * (e.g. Vodacom M-Pesa -> Vodacom M-Pesa) is never cross-network even on a
 * channel that is cross-network-capable in general.
 */
export function isCrossNetwork(channel: Channel, sourceProviderCode: string, destinationProviderCode: string): boolean {
  if (!CROSS_NETWORK_CHANNELS.has(channel)) return false;
  const legs = CHANNEL_LEGS[channel];
  if (legs.source !== legs.destination) return true;
  return sourceProviderCode !== destinationProviderCode;
}

// ---------------------------------------------------------------------------
// Account types
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPES = ["WALLET", "SAVINGS", "CURRENT", "MERCHANT_TILL"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// ---------------------------------------------------------------------------
// MNO / wallet providers
// ---------------------------------------------------------------------------

export interface MnoCapabilities {
  ussdPush: boolean;
  appPush: boolean;
  agentAssisted: boolean;
}

export interface MnoProvider {
  code: string;
  /** Display name is presentation data and can change (e.g. Tigo -> Mixx by Yas) without touching `code`. */
  displayName: string;
  operator: string;
  market: Market;
  /** Soft UX hint only — see detectMnoFromMsisdn. Selcom Pesa owns no range, so this is empty. */
  msisdnPrefixes: string[];
  capabilities: MnoCapabilities;
}

export const MNOS: MnoProvider[] = [
  {
    code: "MPESA_TZ",
    displayName: "M-Pesa",
    operator: "Vodacom",
    market: "TZ",
    msisdnPrefixes: ["74", "75", "76"],
    capabilities: { ussdPush: true, appPush: true, agentAssisted: true },
  },
  {
    code: "TIGO_PESA",
    // Tigo rebranded to Yas; provider code stays stable so this is never a breaking API change.
    displayName: "Mixx by Yas",
    operator: "Yas (formerly Tigo)",
    market: "TZ",
    msisdnPrefixes: ["65", "67", "71"],
    capabilities: { ussdPush: true, appPush: true, agentAssisted: true },
  },
  {
    code: "AIRTEL_MONEY",
    displayName: "Airtel Money",
    operator: "Airtel",
    market: "TZ",
    msisdnPrefixes: ["68", "69", "78"],
    capabilities: { ussdPush: true, appPush: true, agentAssisted: true },
  },
  {
    code: "HALOPESA",
    displayName: "HaloPesa",
    operator: "Halotel",
    market: "TZ",
    msisdnPrefixes: ["61", "62"],
    capabilities: { ussdPush: true, appPush: false, agentAssisted: true },
  },
  {
    code: "TTCL_PESA",
    displayName: "T-Pesa",
    operator: "TTCL",
    market: "TZ",
    msisdnPrefixes: ["73"],
    capabilities: { ussdPush: true, appPush: false, agentAssisted: true },
  },
  {
    code: "SELCOM_PESA",
    displayName: "Selcom Pesa",
    operator: "Selcom",
    market: "TZ",
    // Selcom is a payments company, not a telco — it owns no dedicated MSISDN
    // range, which is exactly why prefix inference can never be a correctness
    // control (see detectMnoFromMsisdn).
    msisdnPrefixes: [],
    capabilities: { ussdPush: false, appPush: true, agentAssisted: true },
  },
];

// ---------------------------------------------------------------------------
// Bank providers
// ---------------------------------------------------------------------------

export interface BankProvider {
  code: string;
  displayName: string;
  market: Market;
  swiftBic: string;
  supportsTips: boolean;
}

export const BANKS: BankProvider[] = [
  { code: "CRDB", displayName: "CRDB Bank", market: "TZ", swiftBic: "CORUTZTZ", supportsTips: true },
  { code: "NMB", displayName: "NMB Bank", market: "TZ", swiftBic: "NMIBTZTZ", supportsTips: true },
  { code: "NBC", displayName: "NBC Bank", market: "TZ", swiftBic: "NLCBTZTX", supportsTips: true },
  { code: "STANBIC_TZ", displayName: "Stanbic Bank Tanzania", market: "TZ", swiftBic: "SBICTZTX", supportsTips: true },
  { code: "EQUITY_TZ", displayName: "Equity Bank Tanzania", market: "TZ", swiftBic: "EQBLTZTZ", supportsTips: false },
];

// ---------------------------------------------------------------------------
// Gateway / card providers
// ---------------------------------------------------------------------------

export interface GatewayProvider {
  code: string;
  displayName: string;
  market: Market;
  acceptedSchemes: string[];
}

export const GATEWAY_PROVIDERS: GatewayProvider[] = [
  { code: "SELCOM_GATEWAY", displayName: "Selcom Gateway", market: "TZ", acceptedSchemes: ["VISA", "MASTERCARD"] },
  { code: "DPO_PAY", displayName: "DPO Pay", market: "TZ", acceptedSchemes: ["VISA", "MASTERCARD", "UNIONPAY"] },
];

export interface CardScheme {
  code: string;
  displayName: string;
  binPrefixes: RegExp;
  lengths: number[];
}

export const CARD_SCHEMES: CardScheme[] = [
  { code: "VISA", displayName: "Visa", binPrefixes: /^4/, lengths: [13, 16, 19] },
  { code: "MASTERCARD", displayName: "Mastercard", binPrefixes: /^(5[1-5]|2[2-7])/, lengths: [16] },
  { code: "UNIONPAY", displayName: "UnionPay", binPrefixes: /^62/, lengths: [16, 17, 18, 19] },
];

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

export type ResolvedProvider = MnoProvider | BankProvider | GatewayProvider;

export function resolveProviderForLeg(legKind: LegKind, providerCode: string): ResolvedProvider | undefined {
  if (legKind === "MNO") return MNOS.find((p) => p.code === providerCode);
  if (legKind === "BANK") return BANKS.find((p) => p.code === providerCode);
  return GATEWAY_PROVIDERS.find((p) => p.code === providerCode);
}

export function resolveProvider(providerCode: string): ResolvedProvider | undefined {
  return (
    MNOS.find((p) => p.code === providerCode) ??
    BANKS.find((p) => p.code === providerCode) ??
    GATEWAY_PROVIDERS.find((p) => p.code === providerCode)
  );
}

export function providerCodesForLeg(legKind: LegKind): string[] {
  if (legKind === "MNO") return MNOS.map((p) => p.code);
  if (legKind === "BANK") return BANKS.map((p) => p.code);
  return GATEWAY_PROVIDERS.map((p) => p.code);
}

export function providerCodesForChannel(channel: Channel): { source: string[]; destination: string[] } {
  const legs = CHANNEL_LEGS[channel];
  return { source: providerCodesForLeg(legs.source), destination: providerCodesForLeg(legs.destination) };
}

// ---------------------------------------------------------------------------
// MSISDN handling
// ---------------------------------------------------------------------------

export function normalizeMsisdn(raw: string, market: Market): string {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  const dialCode = MARKET_STATUS_META[market].dialCode;
  let national = digitsOnly;
  if (digitsOnly.startsWith(dialCode)) {
    national = digitsOnly.slice(dialCode.length);
  } else if (digitsOnly.startsWith("0")) {
    national = digitsOnly.slice(1);
  }
  return `+${dialCode}${national}`;
}

/**
 * SOFT UX HINT ONLY. Selcom Pesa is a payments company with no dedicated
 * MSISDN range, and numbers port between telcos, so a phone prefix cannot
 * reliably determine wallet ownership. Never use this as a correctness
 * control — `providerCode` declared by the caller is the only authoritative
 * signal. This may return a provider that disagrees with the declared one
 * (ported numbers), or no provider at all (Selcom Pesa, or an unrecognised
 * prefix).
 */
export function detectMnoFromMsisdn(msisdn: string, market: Market): MnoProvider | undefined {
  const dialCode = MARKET_STATUS_META[market].dialCode;
  const normalized = normalizeMsisdn(msisdn, market);
  const national = normalized.slice(1 + dialCode.length);
  return MNOS.find((p) => p.market === market && p.msisdnPrefixes.some((prefix) => national.startsWith(prefix)));
}

// ---------------------------------------------------------------------------
// Card handling
// ---------------------------------------------------------------------------

export function detectCardScheme(cardNumber: string): CardScheme | undefined {
  const digits = cardNumber.replace(/\D/g, "");
  return CARD_SCHEMES.find((scheme) => scheme.binPrefixes.test(digits));
}

export function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  const scheme = detectCardScheme(digits);
  if (!scheme || !scheme.lengths.includes(digits.length)) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function formatCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}
