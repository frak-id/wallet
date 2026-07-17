import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { merchantSdkConfigQueryKey } from "@/module/merchant/queries/queryKeys";

const DEMO_SDK_CONFIG: { sdkConfig: SdkConfig } = {
    sdkConfig: {
        name: "E-Commerce Store",
        currency: "eur",
    },
};

export function useSdkConfig({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();
    return useQuery({
        queryKey: merchantSdkConfigQueryKey(merchantId, isDemoMode),
        queryFn: async () => {
            if (isDemoMode) {
                return DEMO_SDK_CONFIG;
            }

            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                ["sdk-config"].get();

            if (error) throw new Error("Failed to fetch SDK config");
            return data;
        },
        enabled: !!merchantId,
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : undefined,
    });
}
