import { keccak256, toHex } from "viem";

/**
 * Compute the content id from a domain
 * @param domain
 */
export function computeContentId({ domain }: { domain: string }) {
    return keccak256(toHex(domain));
}
