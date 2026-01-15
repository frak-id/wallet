import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

type MerchantRole = "owner" | "admin" | "none";

const defaultAccess = {
    role: "none" as MerchantRole,
    isOwner: false,
    isAdmin: false,
    hasAccess: false,
    // Legacy role fields for backward compatibility
    isAdministrator: false,
    isInteractionManager: false,
    isCampaignManager: false,
};

const demoAccess = {
    role: "owner" as MerchantRole,
    isOwner: true,
    isAdmin: false,
    hasAccess: true,
    isAdministrator: true,
    isInteractionManager: true,
    isCampaignManager: true,
};

/**
 * Check the wallet access on a given merchant
 */
export function useHasRoleOnMerchant({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();

    // Query fetching the merchant (which includes role info)
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
            // Return owner access in demo mode
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
                // Legacy fields - map to new role system
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
 * Backward compatibility hook for components still using productId
 * This is a stub that always returns admin access for now
 * @deprecated Use useHasRoleOnMerchant with merchantId instead
 */
export function useHasRoleOnProduct({
    productId: _productId,
}: {
    productId: Hex;
}) {
    // For backward compatibility, return admin access
    // This allows legacy components to continue working
    // TODO: Remove once all components are migrated to merchantId
    return {
        refresh: async () => {},
        rolesReady: true,
        role: "admin" as MerchantRole,
        isOwner: true,
        isAdmin: false,
        hasAccess: true,
        isAdministrator: true,
        isInteractionManager: true,
        isCampaignManager: true,
    };
}
