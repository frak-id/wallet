import { keccak256, toHex } from "viem";

/**
 * Compute the product id from a domain
 * @param domain
 */
export function computeProductId({ domain }: { domain: string }) {
    return keccak256(toHex(domain));
}
