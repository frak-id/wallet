import { keccak256, toHex } from "viem";

/**
 * Compute the product id from a domain
 * @ignore
 */
export function computeProductId({ domain }: { domain?: string }) {
    const effectiveDomain = domain ?? window.location.host;
    const normalizedDomain = effectiveDomain.replace("www.", "");
    return keccak256(toHex(normalizedDomain));
}
