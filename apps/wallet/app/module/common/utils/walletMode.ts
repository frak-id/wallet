/**
 * Build-time wallet mode flag.
 *
 * - `"crypto"` (default): Full wallet experience with send/receive, token breakdowns, addresses
 * - `"loyalty"`: Hides crypto-facing UI, emphasizes loyalty/rewards
 *
 * Set via `VITE_WALLET_MODE` env variable. Vite replaces at build time,
 * enabling dead code elimination for the unused mode.
 */
const walletMode = import.meta.env.VITE_WALLET_MODE ?? "crypto";

/**
 * `true` when full crypto wallet UI is enabled (send/receive, token lists, addresses).
 * `false` in loyalty mode — crypto surfaces are hidden, rewards emphasized.
 */
export const isCryptoMode = walletMode === "crypto";
