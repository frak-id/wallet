import { keccak256, toHex } from "viem";

/**
 * Get product id from shopify domain
 * @param myshopifyDomain
 * @returns
 */
export function productIdFromDomain(myshopifyDomain: string) {
    return keccak256(toHex(myshopifyDomain));
}
