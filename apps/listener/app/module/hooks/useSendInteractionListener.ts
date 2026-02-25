import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { RpcPromiseHandler } from "@frak-labs/frame-connector";
import { useCallback } from "react";
import type { WalletRpcContext } from "@/module/types/context";
import { useSendInteraction } from "./useSendInteraction";

type OnSendInteraction = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_sendInteraction",
    WalletRpcContext
>;

/**
 * RPC handler for frak_sendInteraction method.
 * Fire-and-forget: triggers mutation but doesn't await result.
 */
export function useSendInteractionListener(): OnSendInteraction {
    const { mutate: sendInteraction } = useSendInteraction();

    return useCallback(
        async (params, context) => {
            const [interaction, metadata] = params;

            // Use clientId from RPC metadata (sent by SDK) as primary source,
            // falling back to context.clientId (from handshake).
            // This safeguards against the race condition where the interaction
            // arrives before the handshake-response sets clientId in the store.
            sendInteraction({
                interaction,
                merchantId: context.merchantId,
                clientId: metadata?.clientId ?? context.clientId,
            });
        },
        [sendInteraction]
    );
}
