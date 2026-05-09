import type { SendInteractionParamsType } from "@frak-labs/core-sdk";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { clientIdStore } from "@frak-labs/wallet-shared/stores/clientIdStore";
import { useMutation } from "@tanstack/react-query";
import { resolvingContextStore } from "../stores/resolvingContextStore";

export type SendInteractionInput =
    | SendInteractionParamsType
    | {
          interaction: SendInteractionParamsType;
          merchantId?: string;
          clientId?: string;
      };

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

/**
 * Vanilla, fire-and-forget interaction sender. Reads merchantId from the
 * current resolving context if not provided in the input. Safe to call
 * outside any React tree (used by the listener RPC handlers).
 */
export async function sendInteraction(
    input: SendInteractionInput
): Promise<void> {
    const { interaction, merchantId, clientId } =
        normalizeInteractionInput(input);
    const resolvedMerchantId =
        merchantId ?? resolvingContextStore.getState().context?.merchantId;

    if (clientId) {
        clientIdStore.getState().setClientId(clientId);
    }
    if (!resolvedMerchantId) return;

    try {
        await authenticatedBackendApi.user.track.interaction.post({
            ...interaction,
            merchantId: resolvedMerchantId,
        });
    } catch (error) {
        console.warn(
            "[Listener] Failed to send interaction:",
            interaction.type,
            error
        );
    }
}

/**
 * React adapter for `sendInteraction` — used by Ring 1 UI components
 * (`useTrackSharing`) that want a mutation cache for status flags.
 */
export function useSendInteraction() {
    const context = resolvingContextStore((state) => state.context);

    return useMutation({
        mutationKey: ["send-interaction", context?.merchantId],
        mutationFn: (input: SendInteractionInput) => sendInteraction(input),
    });
}
