import { useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

type MerchantRole = "owner" | "admin" | "none";

const defaultAccess = {
    role: "none" as MerchantRole,
    isOwner: false,
    isAdmin: false,
    hasAccess: false,
};

const demoAccess = {
    role: "owner" as MerchantRole,
    isOwner: true,
    isAdmin: false,
    hasAccess: true,
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
            return {
                role,
                isOwner: role === "owner",
                isAdmin: role === "admin",
                hasAccess: role !== "none",
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
