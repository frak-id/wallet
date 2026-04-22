import type { Address } from "viem";

/**
 * V1 (legacy) Frak Context — contains only the referrer wallet address.
 * Used for backward compatibility with old sharing links.
 * @ignore
 */
export type FrakContextV1 = {
    /** Referrer wallet address */
    r: Address;
};

/**
 * V2 Frak Context — anonymous-first referral context with optional wallet.
 *
 * Carries merchant context (`m`) and creation timestamp (`t`) unconditionally.
 * Identifies the sharer via either the anonymous clientId (`c`) or, when the
 * sharer is authenticated, the stronger wallet identifier (`w`). A valid V2
 * context MUST contain at least one of `c` or `w`; both may be present when
 * a logged-in user shares a link (best attribution signal).
 *
 * `w` takes precedence as the source of truth because the wallet is bound to
 * the user's WebAuthn credential, survives localStorage clears, and is global
 * across merchants — unlike `c`, which is a per-browser UUID.
 *
 * @ignore
 */
export type FrakContextV2 = {
    /** Version discriminator */
    v: 2;
    /** Merchant ID (UUID) */
    m: string;
    /** Link creation timestamp (epoch seconds) */
    t: number;
    /** Sharer's anonymous clientId (UUID from localStorage). Optional when `w` is provided. */
    c?: string;
    /** Sharer's wallet address. Preferred source of truth when the sharer is authenticated. Optional when `c` is provided. */
    w?: Address;
};

/**
 * The current Frak Context — union of all versions.
 *
 * - No `v` field → V1 (legacy wallet address)
 * - `v: 2` → V2 (anonymous clientId-based)
 *
 * @ignore
 */
export type FrakContext = FrakContextV1 | FrakContextV2;

/**
 * Type guard: check if a context is V1 (legacy wallet address).
 * @param ctx - The Frak context to check
 * @returns True if the context is a V1 context
 */
export function isV1Context(ctx: FrakContext): ctx is FrakContextV1 {
    return "r" in ctx && !("v" in ctx);
}

/**
 * Type guard: check if a context is V2 (anonymous clientId-based).
 * @param ctx - The Frak context to check
 * @returns True if the context is a V2 context
 */
export function isV2Context(ctx: FrakContext): ctx is FrakContextV2 {
    return "v" in ctx && ctx.v === 2;
}
