import { type Hex, keccak256, toHex } from "viem";

/** Compute a merchant's productId (keccak256 of its domain). */
export function computeProductId(domain: string): Hex {
    // Unanchored `replace` is deliberate: these hashes are the on-chain
    // product IDs and `legacyBankMap` keys, so changing normalization would
    // break those lookups.
    const normalizedDomain = domain.replace("www.", "");
    return keccak256(toHex(normalizedDomain));
}
