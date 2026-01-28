import { useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

type MerchantRole = "owner" | "admin" | "none";

const defaultAccess = {
    role: "none" as MerchantRole,
    isOwner: false,
    isAdmin: false,
    hasAccess: false,
    isAdministrator: false,
    isInteractionManager: false,
    isCampaignManager: false,
};

const demoAccess = {
    role: "owner" as MerchantRole,
    isOwner: true,
    isAdmin: false,
    hasAccess: true,
    // todo: legacy roles to delete
    isAdministrator: true,
    isInteractionManager: true,
    isCampaignManager: true,
};

export function useHasRoleOnMerchant({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();

    const {
        data: accessResult,
        isSuccess,
        refetch: refresh,
    } = useQuery({
        queryKey: [
            "merchant",
            merchantId,
            "access",
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async () => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                return demoAccess;
            }

            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .get();
            if (!data || error) {
                console.warn("Error when fetching merchant access", error);
                return defaultAccess;
            }

            const role = data.role;
            const isOwner = role === "owner";
            const isAdmin = role === "admin";
            return {
                role,
                isOwner,
                isAdmin,
                hasAccess: role !== "none",
                isAdministrator: isOwner || isAdmin,
                isInteractionManager: isOwner || isAdmin,
                isCampaignManager: isOwner || isAdmin,
            };
        },
        enabled: !!merchantId,
    });

    return {
        refresh,
        rolesReady: isSuccess,
        ...(accessResult ?? defaultAccess),
    };
}

/**
 * @deprecated Use useHasRoleOnMerchant instead
 */
export const useHasRoleOnProduct = useHasRoleOnMerchant;
