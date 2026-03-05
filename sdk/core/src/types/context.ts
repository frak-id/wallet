import type { Address } from "viem";

/**
 * V1 (legacy) Frak Context — contains only the referrer wallet address.
 * Used for backward compatibility with old sharing links.
 * @ignore
 */
export type FrakContextV1 = {
    // Referrer wallet address
    r: Address;
};

/**
 * V2 Frak Context — anonymous-first referral context.
 * Contains the sharer's clientId, merchantId, and link creation timestamp.
 * @ignore
 */
export type FrakContextV2 = {
    // Version discriminator
    v: 2;
    // Sharer's anonymous clientId (from localStorage)
    c: string;
    // Merchant ID (UUID, for future-proofing / fallback)
    m: string;
    // Link creation timestamp (epoch seconds)
    t: number;
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
