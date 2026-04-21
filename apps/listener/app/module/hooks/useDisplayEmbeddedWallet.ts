import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type {
    ExtractReturnType,
    RpcPromiseHandler,
    RpcResponse,
} from "@frak-labs/frame-connector";
import {
    Deferred,
    FrakRpcError,
    RpcErrorCodes,
} from "@frak-labs/frame-connector";
import {
    selectSession,
    sessionStore,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef } from "react";
import type { Hex } from "viem";
import { useListenerUI } from "@/module/providers/ListenerUiProvider";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { WalletRpcContext } from "@/module/types/context";
import { normalizeTargetInteraction } from "@/module/utils/normalizeTargetInteraction";
import { resolveBackendMetadata } from "@/module/utils/resolveBackendMetadata";

type OnDisplayEmbeddedWalletRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayEmbeddedWallet",
    WalletRpcContext
>;

/**
 * Hook used to listen to the display embedded wallet action
 */
export function useDisplayEmbeddedWallet(): OnDisplayEmbeddedWalletRequest {
    const { setRequest } = useListenerUI();
    const session = sessionStore(selectSession);
    const backendConfig = resolvingContextStore((s) => s.backendSdkConfig);

    // Store the current deferred promise for completion
    const currentDeferredRef = useRef<Deferred<{ wallet: Hex }> | null>(null);

    /**
     * Watch for user login
     * - Resolves the deferred when user is logged in
     * - This handles the completion flow for embedded wallet
     */
    useEffect(() => {
        const deferred = currentDeferredRef.current;
        if (!deferred) return;

        // Check if user is logged in
        if (session?.address) {
            // Resolve the deferred with the wallet address
            deferred.resolve({
                wallet: session.address,
            });
            currentDeferredRef.current = null;
        }
    }, [session?.address]);

    /**
     * Cleanup on component unmount
     * - Rejects any pending deferred to prevent memory leaks
     */
    useEffect(() => {
        return () => {
            if (currentDeferredRef.current) {
                currentDeferredRef.current.reject(
                    new FrakRpcError(
                        RpcErrorCodes.clientAborted,
                        "User dismissed the modal"
                    )
                );
                currentDeferredRef.current = null;
            }
        };
    }, []);

    return useCallback(
        async (params) => {
            const configMetadata = params[1];
            const placementFromParams = params.at(2);
            const placementId =
                typeof placementFromParams === "string"
                    ? placementFromParams
                    : undefined;
            const placement = placementId
                ? backendConfig?.placements?.[placementId]
                : undefined;

            // Clean up any existing deferred
            if (currentDeferredRef.current) {
                console.log("arleady got one");
                currentDeferredRef.current.reject(
                    new FrakRpcError(
                        RpcErrorCodes.internalError,
                        "New modal request superseded previous request"
                    )
                );
                currentDeferredRef.current = null;
            }

            // Create a new deferred for this embedded wallet request
            const deferred = new Deferred<{ wallet: Hex }>();
            currentDeferredRef.current = deferred;

            // Capture open state once for duration / state-at-close tracking.
            // Fires on any close path (resolve, reject, unmount, supersede)
            // because every path settles this deferred.
            const openedAt = Date.now();
            const loggedInAtOpen = Boolean(session?.address);
            deferred.promise.finally(() => {
                trackEvent("embedded_wallet_closed", {
                    duration_ms: Date.now() - openedAt,
                    logged_in_at_close: Boolean(
                        sessionStore.getState().session?.address
                    ),
                });
            });
            // Avoid unhandled rejection noise on the tracking promise itself.
            deferred.promise.catch(() => {});

            // Keep the opened event emission next to the matching global
            // state so the (opened, closed) pair is easy to audit.
            trackEvent("embedded_wallet_opened", {
                logged_in: loggedInAtOpen,
            });

            // Create emitter that resolves the deferred
            // This maintains backward compatibility with any legacy code
            const emitter = async (
                response: RpcResponse<
                    ExtractReturnType<
                        IFrameRpcSchema,
                        "frak_displayEmbeddedWallet"
                    >
                >
            ) => {
                if (response.error) {
                    deferred.reject(
                        new FrakRpcError(
                            response.error.code,
                            response.error.message,
                            response.error.data
                        )
                    );
                } else if (response.result) {
                    deferred.resolve(response.result);
                }
            };

            const resolved = resolveBackendMetadata(
                configMetadata,
                backendConfig
            );

            setRequest({
                type: "embedded",
                params: params[0],
                emitter,
                appName: resolved.appName,
                logoUrl: params[0].metadata?.logo ?? resolved.logoUrl,
                homepageLink:
                    params[0].metadata?.homepageLink ?? resolved.homepageLink,
                targetInteraction: normalizeTargetInteraction(
                    placement?.targetInteraction ??
                        params[0].metadata?.targetInteraction
                ),
                i18n: {
                    lang: configMetadata.lang,
                    context: params[0].loggedIn?.action?.key,
                },
                configMetadata,
                placement: placementId,
            });

            // Wait for user login via deferred promise
            // This will resolve when session + sessionStatus are available
            return await deferred.promise;
        },
        [setRequest, backendConfig]
    );
}
