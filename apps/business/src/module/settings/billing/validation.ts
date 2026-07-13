/**
 * Shared form-validation patterns for the billing module's admin forms
 * (AddDepositSheet / AddWithdrawSheet). Split out of `queryKeys.ts`, which is
 * about React Query cache keys, not input validation — the two were
 * unrelated concerns living in the same file.
 */

/** Positive decimal amount, e.g. "1200" or "12.50". */
export const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

/** Non-empty `0x`-prefixed hex string (transaction hash). */
export const TX_HASH_PATTERN = /^0x[0-9a-fA-F]+$/;
