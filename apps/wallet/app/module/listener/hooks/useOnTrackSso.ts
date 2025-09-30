import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import type { WalletRpcContext } from "@/module/listener/types/context";
import { pushBackupData } from "@/module/sdk/utils/backup";
import type { Session } from "@/types/Session";
import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import { RpcErrorCodes } from "@frak-labs/core-sdk";
import type { RpcStreamHandler } from "@frak-labs/rpc";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { useCallback } from "react";
import { trackAuthCompleted, trackAuthFailed } from "../../common/analytics";

type OnTrackSso = RpcStreamHandler<
    IFrameRpcSchema,
    "frak_trackSso",
    WalletRpcContext
>;

/**
 * Hook to track SSO status via streaming
 * Replaces the old polling mechanism with a more efficient streaming approach
 *
 * Note: Context is augmented by middleware with productId, sourceUrl, etc.
 */
export function useOnTrackSso(): OnTrackSso {
    return useCallback(async (params, emitter, context) => {
        // Extract request infos
        const { consumeKey, trackingId } = params[0];
        const { productId } = context;

        // Emit initial pending status
        emitter({
            key: "not-connected",
        });

        // Polling mechanism (to be replaced with backend streaming in Phase 3)
        // For now, we keep polling but with better cleanup support
        const pollInterval = setInterval(async () => {
            try {
                const { data, error } =
                    await authenticatedWalletApi.auth.sso.consume.post({
                        id: trackingId,
                        productId,
                        consumeKey,
                    });

                if (error) {
                    console.error(
                        "Error when trying to consume the SSO session",
                        error
                    );
                    return;
                }

                // If pending, don't emit anything, just continue polling
                if (data.status === "pending") {
                    return;
                }

                // Stop polling for non-pending statuses
                clearInterval(pollInterval);

                // If not found, emit not-connected status
                if (data.status === "not-found") {
                    await trackAuthFailed("sso", "sso-not-found", {
                        ssoId: trackingId,
                    });
                    emitter({
                        key: "not-connected",
                    });
                    return;
                }

                // If successful, save the session and emit connected status
                if (data.status === "ok") {
                    // Extract session data
                    const { token, sdkJwt, ...authentication } = data.session;
                    const session = { ...authentication, token } as Session;

                    // Save this last authentication
                    await jotaiStore.set(addLastAuthenticationAtom, session);

                    // Store the sessions
                    jotaiStore.set(sessionAtom, session);
                    jotaiStore.set(sdkSessionAtom, sdkJwt);

                    // Track the event
                    await trackAuthCompleted("sso", session, {
                        ssoId: trackingId,
                    });

                    // Emit connected status
                    emitter({
                        key: "connected",
                        wallet: session.address,
                        interactionToken: sdkJwt.token,
                    });

                    // Push backup data
                    await pushBackupData({ productId });
                }
            } catch (error) {
                console.error("Error checking SSO status", error);
                // On error, emit error and stop polling
                clearInterval(pollInterval);
                throw {
                    code: RpcErrorCodes.internalError,
                    message: "Failed to track SSO status",
                };
            }
        }, 500);

        // Note: In Phase 3, this will be replaced with a single backend request
        // that streams status updates, eliminating the polling altogether
    }, []);
}
