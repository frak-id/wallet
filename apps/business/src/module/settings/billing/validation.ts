// Shared form-validation patterns for the billing admin forms.

/** Positive decimal amount, e.g. "1200" or "12.50". */
export const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

/** Non-empty `0x`-prefixed hex string (transaction hash). */
export const TX_HASH_PATTERN = /^0x[0-9a-fA-F]+$/;
