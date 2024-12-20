import { keccak256, toHex } from "viem";

/**
 * Compute the product id from a domain
 * @ignore
 */
export function computeProductId({ domain }: { domain?: string }) {
    const effectiveDomain = domain ?? window.location.host;
    return keccak256(toHex(effectiveDomain));
}
