import type {
    DisplaySharingPageResultType,
    IFrameRpcSchema,
} from "@frak-labs/core-sdk";
import {
    Deferred,
    type ExtractReturnType,
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
    type RpcResponse,
} from "@frak-labs/frame-connector";
import { trackEvent } from "@frak-labs/wallet-shared";
import { useCallback, useRef } from "react";
import { useListenerUI } from "@/module/providers/ListenerUiProvider";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { WalletRpcContext } from "@/module/types/context";
import { normalizeTargetInteraction } from "@/module/utils/normalizeTargetInteraction";
import { resolveBackendMetadata } from "@/module/utils/resolveBackendMetadata";

type OnDisplaySharingPageRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displaySharingPage",
    WalletRpcContext
>;

/**
 * Hook used to listen to the display sharing page action
 *
 * The sharing page resolves on the first user action (share/copy) but stays visible.
 * Dismissing after a share/copy is a no-op (promise already resolved).
 */
export function useDisplaySharingPageListener(): OnDisplaySharingPageRequest {
    const { setRequest } = useListenerUI();
    const backendConfig = resolvingContextStore((s) => s.backendSdkConfig);

    // Store the current deferred promise for completion
    const currentDeferredRef =
        useRef<Deferred<DisplaySharingPageResultType> | null>(null);

    return useCallback(
        async (params) => {
            const request = params[0];
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
                currentDeferredRef.current.reject(
                    new FrakRpcError(
                        RpcErrorCodes.internalError,
                        "New sharing page request superseded previous request"
                    )
                );
                currentDeferredRef.current = null;
            }

            // Create a new deferred for this sharing page request
            const deferred = new Deferred<DisplaySharingPageResultType>();
            currentDeferredRef.current = deferred;

            // Create emitter that resolves the deferred
            const emitter = async (
                response: RpcResponse<
                    ExtractReturnType<
                        IFrameRpcSchema,
                        "frak_displaySharingPage"
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
                type: "sharing",
                params: request,
                emitter,
                appName: resolved.appName,
                logoUrl: request.metadata?.logo ?? resolved.logoUrl,
                homepageLink:
                    request.metadata?.homepageLink ?? resolved.homepageLink,
                targetInteraction: normalizeTargetInteraction(
                    placement?.targetInteraction ??
                        request.metadata?.targetInteraction
                ),
                i18n: {
                    lang: configMetadata?.lang,
                    context: "sharing",
                },
                configMetadata,
                placement: placementId,
            });

            trackEvent("sharing_page_opened");

            // Wait for user action via deferred promise
            return await deferred.promise;
        },
        [setRequest, backendConfig]
    );
}
