import type {
    DisplaySharingPageResultType,
    IFrameRpcSchema,
} from "@frak-labs/core-sdk";
import {
    Deferred,
    type ExtractReturnType,
    FrakRpcError,
    type RpcPromiseHandler,
    RpcErrorCodes,
    type RpcResponse,
} from "@frak-labs/frame-connector";
import { trackEvent } from "@frak-labs/wallet-shared/common/analytics";
import type { UIRequest } from "@/module/providers/ListenerUiProvider";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { WalletRpcContext } from "@/module/types/context";
import { normalizeTargetInteraction } from "@/module/utils/normalizeTargetInteraction";
import { resolveBackendMetadata } from "@/module/utils/resolveBackendMetadata";

type OnDisplaySharingPageRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displaySharingPage",
    WalletRpcContext
>;

// Module-level deferred (the listener mounts once per iframe lifetime),
// preserving the "supersede previous request" semantics from the
// original ref-based hook.
let pendingDeferred: Deferred<DisplaySharingPageResultType> | null = null;

type DisplaySharingPageDeps = {
    setRequest: (request: UIRequest) => void;
};

/**
 * Heavy body for `frak_displaySharingPage`. Loaded only when the partner
 * site actually triggers the sharing flow.
 */
export const handleDisplaySharingPage = async (
    params: Parameters<OnDisplaySharingPageRequest>[0],
    { setRequest }: DisplaySharingPageDeps
): Promise<DisplaySharingPageResultType> => {
    const backendConfig = resolvingContextStore.getState().backendSdkConfig;

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
    if (pendingDeferred) {
        pendingDeferred.reject(
            new FrakRpcError(
                RpcErrorCodes.internalError,
                "New sharing page request superseded previous request"
            )
        );
        pendingDeferred = null;
    }

    // Create a new deferred for this sharing page request
    const deferred = new Deferred<DisplaySharingPageResultType>();
    pendingDeferred = deferred;

    // Create emitter that resolves the deferred
    const emitter = async (
        response: RpcResponse<
            ExtractReturnType<IFrameRpcSchema, "frak_displaySharingPage">
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

    const resolved = resolveBackendMetadata(configMetadata, backendConfig);

    setRequest({
        type: "sharing",
        params: request,
        emitter,
        appName: resolved.appName,
        logoUrl: request.metadata?.logo ?? resolved.logoUrl,
        homepageLink:
            request.metadata?.homepageLink ?? resolved.homepageLink,
        targetInteraction: normalizeTargetInteraction(
            placement?.targetInteraction ?? request.metadata?.targetInteraction
        ),
        i18n: {
            lang: configMetadata?.lang,
            context: "sharing",
        },
        configMetadata,
        placement: placementId,
    });

    trackEvent("sharing_page_opened");

    try {
        // Wait for user action via deferred promise
        return await deferred.promise;
    } finally {
        if (pendingDeferred === deferred) {
            pendingDeferred = null;
        }
    }
};
