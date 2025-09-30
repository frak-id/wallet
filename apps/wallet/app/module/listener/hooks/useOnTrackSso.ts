import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { pushBackupData } from "@/module/sdk/utils/backup";
import type { IFrameRequestResolver } from "@/module/sdk/utils/iFrameRequestResolver";
import type { Session } from "@/types/Session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/core-sdk";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { useCallback } from "react";
import { trackAuthCompleted, trackAuthFailed } from "../../common/analytics";

type OnTrackSso = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_trackSso" }
    >
>;

/**
 * Hook to track SSO status via polling
 */
export function useOnTrackSso(): OnTrackSso {
    return useCallback(async (request, context, emitter) => {
        // Extract request infos
        const { consumeKey, trackingId } = request.params[0];
        const { productId } = context;

        const abortController = new AbortController();
        let pollInterval: NodeJS.Timeout | undefined;

        // Function to check SSO status and emit updates
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Will be refacto
        const checkSsoStatus = async () => {
            if (abortController.signal.aborted) {
                return;
            }

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
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = undefined;
                }

                // If not found, emit not-connected status
                if (data.status === "not-found") {
                    await trackAuthFailed("sso", "sso-not-found", {
                        ssoId: trackingId,
                    });
                    await emitter({
                        result: {
                            key: "not-connected",
                        },
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
                    await emitter({
                        result: {
                            key: "connected",
                            wallet: session.address,
                            interactionToken: sdkJwt.token,
                        },
                    });

                    // Push backup data
                    await pushBackupData({ productId });
                }
            } catch (error) {
                console.error("Error checking SSO status", error);
            }
        };

        // Start polling immediately
        await checkSsoStatus();

        // Set up polling interval (500ms for frequent checks)
        pollInterval = setInterval(() => {
            checkSsoStatus();
        }, 500);

        // Cleanup function (though we can't easily hook into request cancellation)
        // The interval will continue until a final status is reached
    }, []);
}
