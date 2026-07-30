import { HoscooClient, type InitOptions } from "./client";

export const hoscoo = {
  init(options: InitOptions): HoscooClient {
    return HoscooClient.init(options);
  },
};

export { HoscooClient } from "./client";
export type { InitOptions, InitiatePaymentInput, PaymentResult, FxQuoteResult, LegInput, SdkMode } from "./client";
export { HoscooSdkError, HoscooModeKeyMismatchError } from "./errors";
