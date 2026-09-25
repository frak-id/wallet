import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { merchantSdkConfigQueryKey } from "@/module/merchant/queries/queryKeys";

type Components = NonNullable<SdkConfig["components"]>;

/**
 * Saves some store-wide components over the cached ones. The backend replaces
 * `components` whole, and one page Save runs every dirty section with the same
 * render's props, so each section must build on what the previous one wrote.
 */
export function useSaveComponents(merchantId: string) {
    const queryClient = useQueryClient();
    const isDemoMode = useIsDemoMode();
    const { mutateAsync, isSuccess } = useMerchantUpdate({
        merchantId,
        target: "sdk-config",
    });

    const saveComponents = useCallback(
        async (patch: Partial<Components>) => {
            const key = merchantSdkConfigQueryKey(merchantId, isDemoMode);
            const cached = queryClient.getQueryData<{ sdkConfig: SdkConfig }>(
                key
            );
            const components = { ...cached?.sdkConfig.components, ...patch };
            await mutateAsync({ components });
            queryClient.setQueryData(key, {
                ...cached,
                sdkConfig: { ...cached?.sdkConfig, components },
            });
        },
        [merchantId, isDemoMode, queryClient, mutateAsync]
    );

    return { saveComponents, isSuccess };
}
