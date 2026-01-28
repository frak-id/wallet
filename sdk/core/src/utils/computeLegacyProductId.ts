import { keccak256, toHex } from "viem";

/**
 * Compute the legacy product id from a domain
 * @ignore
 */
export function computeLegacyProductId({ domain }: { domain?: string } = {}) {
    const effectiveDomain = domain ?? window.location.host;
    const normalizedDomain = effectiveDomain.replace("www.", "");
    return keccak256(toHex(normalizedDomain));
}
