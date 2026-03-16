import { queryOptions } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";
import merchantsMockData from "@/mock/merchants.json";
import { useAuthStore } from "@/stores/authStore";

/**
 * Check demo mode via param or Zustand store
 */
function checkDemoMode(isDemoModeParam: boolean): boolean {
    if (isDemoModeParam) return true;
    return useAuthStore.getState().token === "demo-token";
}

export type MerchantRole = "owner" | "admin" | "none";

export type MerchantData = {
    id: string;
    domain: string;
    name: string;
    ownerWallet: Address;
    bankAddress: Address | null;
    defaultRewardToken: Address;
    explorerConfig: { heroImageUrl?: string; description?: string } | null;
    explorerEnabledAt: string | null;
    verifiedAt: string | null;
    createdAt: string | null;
    role: MerchantRole;
    productId?: Hex;
};

function getMerchantMockData(merchantId: string): MerchantData {
    const allMerchants = [
        ...merchantsMockData.owned,
        ...merchantsMockData.adminOf,
    ];
    const merchant = allMerchants.find((m) => m.id === merchantId);
    return (merchant ?? merchantsMockData.owned[0]) as MerchantData;
}

/**
 * Query options for fetching merchant data
 */
export const merchantQueryOptions = (merchantId: string, isDemoMode: boolean) =>
    queryOptions({
        queryKey: ["merchant", merchantId, isDemoMode ? "demo" : "live"],
        enabled: !!merchantId,
        queryFn: async (): Promise<MerchantData> => {
            const isDemo = checkDemoMode(isDemoMode);

            // Return mock data in demo mode
            if (isDemo) {
                return getMerchantMockData(merchantId);
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
                explorerConfig: data.explorerConfig,
                explorerEnabledAt: data.explorerEnabledAt,
                verifiedAt: data.verifiedAt,
                createdAt: data.createdAt,
                role: data.role,
            };
        },
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: isDemoMode ? getMerchantMockData(merchantId) : undefined,
    });

function getMyMerchantsMockData(): {
    owned: MerchantData[];
    adminOf: MerchantData[];
} {
    return {
        owned: merchantsMockData.owned as MerchantData[],
        adminOf: merchantsMockData.adminOf as MerchantData[],
    };
}

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
                return getMyMerchantsMockData();
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
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 2 * 60 * 1000,
        initialData: isDemoMode ? getMyMerchantsMockData() : undefined,
    });
