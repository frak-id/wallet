import { useQuery } from "@tanstack/react-query";
import { type Hex, keccak256, toHex } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import {
    type MerchantData,
    merchantQueryOptions,
} from "@/module/merchant/queries/queryOptions";

/**
 * Compute productId from domain (keccak256 hash)
 */
export function computeProductId(domain: string): Hex {
    const normalizedDomain = domain.replace("www.", "");
    return keccak256(toHex(normalizedDomain));
}

/**
 * Hook to fetch merchant data with computed productId
 */
export function useMerchant({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();
    const queryResult = useQuery(merchantQueryOptions(merchantId, isDemoMode));

    // Compute productId from domain for on-chain operations
    const productId = queryResult.data?.domain
        ? computeProductId(queryResult.data.domain)
        : undefined;

    return {
        ...queryResult,
        data: queryResult.data
            ? {
                  ...queryResult.data,
                  productId,
              }
            : undefined,
    };
}

export type MerchantWithProductId = MerchantData & {
    productId?: Hex;
};
