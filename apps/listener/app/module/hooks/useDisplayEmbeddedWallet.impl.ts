import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    Deferred,
    type ExtractReturnType,
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
    type RpcResponse,
} from "@frak-labs/frame-connector";
import { trackEvent } from "@frak-labs/wallet-shared/common/analytics";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import type { Hex } from "viem";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { WalletRpcContext } from "@/module/types/context";
import { normalizeTargetInteraction } from "@/module/utils/normalizeTargetInteraction";
import { resolveBackendMetadata } from "@/module/utils/resolveBackendMetadata";
import type { UIRequest } from "@/ui/ListenerUiProvider";

type OnDisplayEmbeddedWalletRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayEmbeddedWallet",
    WalletRpcContext
>;

// Module-level singletons (the listener mounts once per iframe lifetime).
// Replace the per-render refs the React hook used while preserving the
// "supersede previous request" semantics.
let pendingDeferred: Deferred<{ wallet: Hex }> | null = null;
let pendingUnsubscribe: (() => void) | null = null;

type DisplayEmbeddedWalletDeps = {
    setRequest: (request: UIRequest) => void;
};

/**
 * Heavy body for `frak_displayEmbeddedWallet`. Loaded only when the
 * partner site actually asks the iframe to display the wallet UI.
 */
export const handleDisplayEmbeddedWallet = async (
    params: Parameters<OnDisplayEmbeddedWalletRequest>[0],
    { setRequest }: DisplayEmbeddedWalletDeps
): Promise<{ wallet: Hex }> => {
    const backendConfig = resolvingContextStore.getState().backendSdkConfig;
    const sessionAtOpen = sessionStore.getState().session;

    const configMetadata = params[1];
    const placementFromParams = params.at(2);
    const placementId =
        typeof placementFromParams === "string"
            ? placementFromParams
            : undefined;
    const placement = placementId
        ? backendConfig?.placements?.[placementId]
        : undefined;

    // Supersede any in-flight request — both the deferred and the
    // session subscription that backed it.
    pendingUnsubscribe?.();
    pendingUnsubscribe = null;
    if (pendingDeferred) {
        pendingDeferred.reject(
            new FrakRpcError(
                RpcErrorCodes.internalError,
                "New modal request superseded previous request"
            )
        );
        pendingDeferred = null;
    }

    // Create a new deferred for this embedded wallet request
    const deferred = new Deferred<{ wallet: Hex }>();
    pendingDeferred = deferred;

    // Resolve as soon as the user is logged in. The original hook watched
    // `session?.address` via `useEffect`; subscribing directly to the store
    // keeps that behaviour while letting the wrapper hook stay tiny.
    const unsubscribe = sessionStore.subscribe((state) => {
        const address = state.session?.address;
        if (!address) return;
        if (pendingDeferred !== deferred) return;
        deferred.resolve({ wallet: address });
        pendingDeferred = null;
        pendingUnsubscribe = null;
        unsubscribe();
    });
    pendingUnsubscribe = unsubscribe;

    // Capture open state once for duration / state-at-close tracking.
    // Fires on any close path (resolve, reject, supersede) because
    // every path settles this deferred.
    const openedAt = Date.now();
    const loggedInAtOpen = Boolean(sessionAtOpen?.address);
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
            ExtractReturnType<IFrameRpcSchema, "frak_displayEmbeddedWallet">
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
        type: "embedded",
        params: params[0],
        emitter,
        appName: resolved.appName,
        logoUrl: params[0].metadata?.logo ?? resolved.logoUrl,
        homepageLink: params[0].metadata?.homepageLink ?? resolved.homepageLink,
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
};
