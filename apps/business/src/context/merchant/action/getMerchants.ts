import { authenticatedBackendApi } from "@/context/api/backendClient";
import { getMyMerchantsMock } from "@/context/merchant/action/mock";

export type GetMerchantsResult = {
    owner: { id: string; name: string; domain: string }[];
    operator: { id: string; name: string; domain: string }[];
};

/**
 * Get all the user merchants from the backend API
 */
export async function getMyMerchants(
    isDemoMode: boolean
): Promise<GetMerchantsResult> {
    // Check if demo mode is active
    if (isDemoMode) {
        return getMyMerchantsMock();
    }

    const { data, error } = await authenticatedBackendApi.merchant.my.get();

    if (!data || error) {
        console.warn("Error when fetching merchants", error);
        return { owner: [], operator: [] };
    }

    return {
        owner: data.owned.map((m) => ({
            id: m.id,
            name: m.name,
            domain: m.domain,
        })),
        operator: data.adminOf.map((m) => ({
            id: m.id,
            name: m.name,
            domain: m.domain,
        })),
    };
}
