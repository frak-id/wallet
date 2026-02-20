import type { SendInteractionParamsType } from "@frak-labs/core-sdk";
import {
    authenticatedBackendApi,
    clientIdStore,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { extractUtmParams } from "@/module/common/utmParams";
import { resolvingContextStore } from "../stores/resolvingContextStore";

export type SendInteractionInput =
    | SendInteractionParamsType
    | {
          interaction: SendInteractionParamsType;
          merchantId?: string;
          clientId?: string;
      };

export function useSendInteraction() {
    const context = resolvingContextStore((state) => state.context);

    return useMutation({
        mutationKey: ["send-interaction", context?.merchantId],
        mutationFn: async (input: SendInteractionInput) => {
            const { interaction, merchantId, clientId } =
                normalizeInteractionInput(input);
            const resolvedMerchantId = merchantId ?? context?.merchantId;

            if (clientId) {
                clientIdStore.getState().setClientId(clientId);
            }
            if (!resolvedMerchantId) return;

            const enrichedParams =
                interaction.type === "arrival" && interaction.landingUrl
                    ? enrichArrivalWithUtm(interaction)
                    : interaction;

            try {
                await authenticatedBackendApi.user.track.interaction.post({
                    ...enrichedParams,
                    merchantId: resolvedMerchantId,
                });
            } catch (error) {
                console.warn(
                    "[Listener] Failed to send interaction:",
                    interaction.type,
                    error
                );
            }
        },
    });
}

function normalizeInteractionInput(input: SendInteractionInput): {
    interaction: SendInteractionParamsType;
    merchantId?: string;
    clientId?: string;
} {
    if ("interaction" in input) {
        return input;
    }

    return { interaction: input };
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
