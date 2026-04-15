import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { useCallback } from "react";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { WalletRpcContext } from "@/module/types/context";
import { useSendInteraction } from "./useSendInteraction";

type OnSendInteraction = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_sendInteraction",
    WalletRpcContext
>;

export function useSendInteractionListener(): OnSendInteraction {
    const { mutate: sendInteraction } = useSendInteraction();
    const trustLevel = resolvingContextStore((s) => s.trustLevel);

    return useCallback(
        async (params, context) => {
            if (trustLevel !== "verified") {
                const reason =
                    trustLevel === "unverified"
                        ? "Interactions disabled: domain not verified and no merchant config available. Check backend connectivity."
                        : "Interactions disabled in dev mode. Register your domain in the dashboard for production use.";
                console.warn(`[Frak] ${reason}`);
                throw new FrakRpcError(RpcErrorCodes.configError, reason);
            }

            const [interaction, metadata] = params;

            // Use clientId from RPC metadata (sent by SDK) as primary source,
            // falling back to context.clientId (from resolved-config).
            sendInteraction({
                interaction,
                merchantId: context.merchantId,
                clientId: metadata?.clientId ?? context.clientId,
            });
        },
        [sendInteraction, trustLevel]
    );
}
