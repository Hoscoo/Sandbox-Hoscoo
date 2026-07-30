/** In-memory FX quote store, keyed by quoteId. Same durability caveat as lib/sandbox/store.ts. */
import type { FxQuote } from "../corridors";

const QUOTES = new Map<string, FxQuote>();

export function putQuote(quote: FxQuote): void {
  QUOTES.set(quote.quoteId, quote);
}

export function getQuote(quoteId: string): FxQuote | undefined {
  return QUOTES.get(quoteId);
}

export function isQuoteExpired(quote: FxQuote, now: Date = new Date()): boolean {
  return new Date(quote.expiresAt).getTime() <= now.getTime();
}
