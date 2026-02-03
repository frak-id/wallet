import type { SendInteractionParamsType } from "@frak-labs/core-sdk";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { extractUtmParams } from "@/module/common/utmParams";
import { useSafeResolvingContext } from "@/module/stores/hooks";

export function useSendInteraction() {
    const { merchantId } = useSafeResolvingContext();

    return useMutation({
        mutationKey: ["send-interaction", merchantId],
        mutationFn: async (params: SendInteractionParamsType) => {
            if (!merchantId) return;

            const enrichedParams =
                params.type === "arrival" && params.landingUrl
                    ? enrichArrivalWithUtm(params)
                    : params;

            try {
                await authenticatedBackendApi.user.track.interaction.post({
                    ...enrichedParams,
                    merchantId,
                });
            } catch (error) {
                console.warn(
                    "[Listener] Failed to send interaction:",
                    params.type,
                    error
                );
            }
        },
    });
}

function enrichArrivalWithUtm(
    params: Extract<SendInteractionParamsType, { type: "arrival" }>
): SendInteractionParamsType {
    const utmParams = extractUtmParams(params.landingUrl);
    if (!utmParams) return params;

    return {
        ...params,
        utmSource: utmParams.source,
        utmMedium: utmParams.medium,
        utmCampaign: utmParams.campaign,
        utmTerm: utmParams.term,
        utmContent: utmParams.content,
    };
}
