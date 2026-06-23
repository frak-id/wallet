import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { TrustLevel } from "@/module/stores/types";
import type { WalletRpcContext } from "@/module/types/context";
import { sendInteraction } from "./useSendInteraction";

type OnSendInteraction = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_sendInteraction",
    WalletRpcContext
>;

type Deps = {
    /**
     * Resolve the current trust level. Defaults to reading the resolving
     * context store. Override in tests for stable assertions.
     */
    getTrustLevel?: () => TrustLevel;
};

export function createSendInteractionHandler({
    getTrustLevel = () => resolvingContextStore.getState().trustLevel,
}: Deps = {}): OnSendInteraction {
    return async (params, context) => {
        const trustLevel = getTrustLevel();
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
        void sendInteraction({
            interaction,
            merchantId: context.merchantId,
            clientId: metadata?.clientId ?? context.clientId,
        });
    };
}
