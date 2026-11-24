import type {
    DisplaySharingPageResultType,
    IFrameRpcSchema,
} from "@frak-labs/core-sdk";
import {
    Deferred,
    type ExtractReturnType,
    FrakRpcError,
    type RpcPromiseHandler,
    type RpcResponse,
} from "@frak-labs/frame-connector";
import { trackEvent } from "@frak-labs/wallet-shared/common/analytics";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { WalletRpcContext } from "@/module/types/context";
import { normalizeTargetInteraction } from "@/module/utils/normalizeTargetInteraction";
import { resolveBackendMetadata } from "@/module/utils/resolveBackendMetadata";
import type { UIRequest } from "@/ui/ListenerUiProvider";

type OnDisplaySharingPageRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displaySharingPage",
    WalletRpcContext
>;

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
    // Unvalidated RPC payload, and a merchant calling the action directly sets none.
    const rawEntryPoint = request.metadata?.entryPoint;
    const entryPoint =
        typeof rawEntryPoint === "string" ? rawEntryPoint : undefined;

    // Create a new deferred for this sharing page request
    const deferred = new Deferred<DisplaySharingPageResultType>();

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
        homepageLink: request.metadata?.homepageLink ?? resolved.homepageLink,
        targetInteraction: normalizeTargetInteraction(
            placement?.targetInteraction ?? request.metadata?.targetInteraction
        ),
        i18n: {
            lang: configMetadata?.lang,
            context: "sharing",
        },
        configMetadata,
        placement: placementId,
        entryPoint,
    });

    trackEvent("sharing_page_opened", {
        entry_point: entryPoint,
        placement: placementId,
    });

    // Wait for user action via deferred promise
    return await deferred.promise;
};
