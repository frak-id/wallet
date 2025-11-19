import { useSuspenseQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { useAuthStore } from "@/stores/authStore";

/**
 * Hook to get the product metadata
 */
export function useProductMetadata({ productId }: { productId: Hex }) {
    const isDemoMode = useAuthStore((state) => state.isDemoMode);
    return useSuspenseQuery(productMetadataQueryOptions(productId, isDemoMode));
}

export type ProductMetadata = ReturnType<typeof useProductMetadata>["data"];
