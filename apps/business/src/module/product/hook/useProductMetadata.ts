import { useSuspenseQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { productMetadataQueryOptions } from "@/module/product/queries/queryOptions";
import { demoModeStore } from "@/stores/demoModeStore";

/**
 * Hook to get the product metadata
 */
export function useProductMetadata({ productId }: { productId: Hex }) {
    const isDemoMode = demoModeStore((state) => state.isDemoMode);
    return useSuspenseQuery(productMetadataQueryOptions(productId, isDemoMode));
}

export type ProductMetadata = ReturnType<typeof useProductMetadata>["data"];
