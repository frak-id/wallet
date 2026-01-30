import { queryOptions } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import merchantsMockData from "@/mock/merchants.json";
import { useAuthStore } from "@/stores/authStore";

/**
 * Check demo mode - works on both client and server
 * On server during SSR, we can't reliably check auth state, so we return
 * the passed parameter. On client, we double-check with Zustand store.
 */
function checkDemoMode(isDemoModeParam: boolean): boolean {
    if (isDemoModeParam) return true;
    // On client, check Zustand store directly
    if (typeof window !== "undefined") {
        return useAuthStore.getState().token === "demo-token";
    }
    // On server, trust the param
    return false;
}

/**
 * Check if we're running on the server (SSR)
 */
function isServer(): boolean {
    return typeof window === "undefined";
}

export type MerchantRole = "owner" | "admin" | "none";

export type MerchantData = {
    id: string;
    domain: string;
    name: string;
    ownerWallet: Address;
    bankAddress: Address | null;
    defaultRewardToken: Address;
    config: { [key: string]: object } | null;
    verifiedAt: string | null;
    createdAt: string | null;
    role: MerchantRole;
    productId?: Hex;
};

/**
 * Query options for fetching merchant data
 */
export const merchantQueryOptions = (merchantId: string, isDemoMode: boolean) =>
    queryOptions({
        queryKey: ["merchant", merchantId, isDemoMode ? "demo" : "live"],
        queryFn: async (): Promise<MerchantData> => {
            const isDemo = checkDemoMode(isDemoMode);

            // Return mock data in demo mode
            if (isDemo) {
                await new Promise((resolve) => setTimeout(resolve, 150));
                const allMerchants = [
                    ...merchantsMockData.owned,
                    ...merchantsMockData.adminOf,
                ];
                const merchant = allMerchants.find((m) => m.id === merchantId);
                if (merchant) {
                    return merchant as MerchantData;
                }
                // Return first mock merchant as fallback
                return merchantsMockData.owned[0] as MerchantData;
            }

            // On server during SSR, we can't make authenticated API calls reliably.
            // Return mock data and let client hydrate with real data.
            if (isServer()) {
                return merchantsMockData.owned[0] as MerchantData;
            }

            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .get();

            if (error || !data) {
                throw new Error(
                    typeof error === "string"
                        ? error
                        : "Failed to fetch merchant"
                );
            }

            return {
                id: data.id,
                domain: data.domain,
                name: data.name,
                ownerWallet: data.ownerWallet,
                bankAddress: data.bankAddress,
                defaultRewardToken: data.defaultRewardToken,
                config: data.config,
                verifiedAt: data.verifiedAt,
                createdAt: data.createdAt,
                role: data.role,
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

/**
 * Query options for fetching user's merchants
 */
export const myMerchantsQueryOptions = (isDemoMode: boolean) =>
    queryOptions({
        queryKey: ["merchant", "my", isDemoMode ? "demo" : "live"],
        queryFn: async () => {
            const isDemo = checkDemoMode(isDemoMode);

            // Return mock data in demo mode
            if (isDemo) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                return {
                    owned: merchantsMockData.owned as MerchantData[],
                    adminOf: merchantsMockData.adminOf as MerchantData[],
                };
            }

            // On server during SSR without demo mode param, we can't make
            // authenticated API calls reliably. Return empty and let client hydrate.
            if (isServer()) {
                return {
                    owned: [] as MerchantData[],
                    adminOf: [] as MerchantData[],
                };
            }

            const { data, error } =
                await authenticatedBackendApi.merchant.my.get();

            if (error || !data) {
                throw new Error("Failed to fetch merchants");
            }

            return {
                owned: data.owned,
                adminOf: data.adminOf,
            };
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
