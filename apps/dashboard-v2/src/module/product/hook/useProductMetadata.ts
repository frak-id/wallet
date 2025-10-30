import {
    addresses,
    bytesToString,
    productRegistryAbi,
} from "@frak-labs/app-essentials";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { readContract } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";
import { decodeProductTypesMask } from "@/module/product/utils/productTypes";
import { demoModeStore } from "@/stores/demoModeStore";

/**
 * Mock product metadata for demo mode
 */
const MOCK_PRODUCTS: Record<
    string,
    { name: string; domain: string; productTypes: ProductTypesKey[] }
> = {
    "0x0000000000000000000000000000000000000000000000000000000000000001": {
        name: "E-Commerce Store",
        domain: "shop.example.com",
        productTypes: ["webshop"],
    },
    "0x0000000000000000000000000000000000000000000000000000000000000002": {
        name: "Digital Media Platform",
        domain: "media.example.com",
        productTypes: ["press"],
    },
    "0x0000000000000000000000000000000000000000000000000000000000000003": {
        name: "SaaS Application",
        domain: "app.example.com",
        productTypes: ["dapp"],
    },
    "0x0000000000000000000000000000000000000000000000000000000000000010": {
        name: "Demo Product",
        domain: "demo.example.com",
        productTypes: ["webshop", "press"],
    },
};

const DEFAULT_MOCK_PRODUCT = {
    name: "Demo Product",
    domain: "demo.example.com",
    productTypes: ["webshop"] as ProductTypesKey[],
};

/**
 * Hook to get the product metadata
 */
export function useProductMetadata({ productId }: { productId?: Hex }) {
    const isDemoMode = demoModeStore((state) => state.isDemoMode);

    return useQuery({
        queryKey: [
            "product",
            "metadata",
            productId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async () => {
            if (!productId) return;

            // Return mock data in demo mode
            if (isDemoMode) {
                const mockProduct =
                    MOCK_PRODUCTS[productId] ?? DEFAULT_MOCK_PRODUCT;

                return {
                    name: mockProduct.name,
                    domain: mockProduct.domain,
                    productTypes: mockProduct.productTypes,
                    productTypes_raw: 0n,
                };
            }

            const metadata = await readContract(viemClient, {
                address: addresses.productRegistry,
                abi: productRegistryAbi,
                functionName: "getMetadata",
                args: [BigInt(productId)],
            });

            return {
                ...metadata,
                name: bytesToString(metadata.name),
                productTypes: decodeProductTypesMask(metadata.productTypes),
            };
        },
        enabled: !!productId,
    });
}

export type ProductMetadata = ReturnType<typeof useProductMetadata>["data"];
