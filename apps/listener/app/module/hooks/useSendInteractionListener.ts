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
            const [interaction] = params;

            // Fire-and-forget: trigger mutation but don't await
            sendInteraction({
                interaction,
                merchantId: context.merchantId,
                clientId: context.clientId,
            });
        },
        [sendInteraction]
    );
}
