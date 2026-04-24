import type { FrakLifecycleEvent } from "@frak-labs/core-sdk";
import { createRpcListener } from "@frak-labs/frame-connector";
import i18next from "i18next";
import { useEffect } from "react";
import { ListenerUiRenderer } from "@/module/component/ListenerUiRenderer";
import {
    clientLifecycleHandler,
    emitConnected,
} from "@/module/handlers/lifecycleHandler";
import {
    handleOpenSso,
    handlePrepareSso,
    handleSsoComplete,
} from "@/module/handlers/ssoHandler";
import { useDisplayEmbeddedWallet } from "@/module/hooks/useDisplayEmbeddedWallet";
import { useDisplayModalListener } from "@/module/hooks/useDisplayModalListener";
import { useDisplaySharingPageListener } from "@/module/hooks/useDisplaySharingPageListener";
import { useListenerDataPreload } from "@/module/hooks/useListenerDataPreload";
import { useOnGetMerchantInformation } from "@/module/hooks/useOnGetMerchantInformation";
import { useOnGetMergeToken } from "@/module/hooks/useOnGetMergeToken";
import { useOnGetUserReferralStatus } from "@/module/hooks/useOnGetUserReferralStatus";
import { useSendInteractionListener } from "@/module/hooks/useSendInteractionListener";
import { useSendPing } from "@/module/hooks/useSendPing";
import { useWalletStatusListener } from "@/module/hooks/useWalletStatusListener";
import {
    loggingMiddleware,
    walletContextMiddleware,
} from "@/module/middleware";
import { ListenerUiProvider } from "@/module/providers/ListenerUiProvider";
import type {
    CombinedRpcSchema,
    WalletRpcContext,
} from "@/module/types/context";

/**
 * Top level listener, wrapped with the Listener Ui context
 */
export default function Listener() {
    return (
        <ListenerUiProvider>
            <ListenerContent />
        </ListenerUiProvider>
    );
}

/**
 * Global Listener UI that can only be set via an iFrame
 *  - It's goal is to answer every request from the iFrame windows parent
 * @constructor
 */
function ListenerContent() {
    // Hook used when a wallet status is requested
    const onWalletListenRequest = useWalletStatusListener();

    // Hook when a modal display is asked
    const onDisplayModalRequest = useDisplayModalListener();

    // Hook when a embedded wallet display is asked
    const onDisplayEmbeddedWallet = useDisplayEmbeddedWallet();

    const onGetMerchantInformation = useOnGetMerchantInformation();

    const onSendInteraction = useSendInteractionListener();

    const onGetUserReferralStatus = useOnGetUserReferralStatus();

    const onGetMergeToken = useOnGetMergeToken();

    // Hook when a sharing page display is asked
    const onDisplaySharingPage = useDisplaySharingPageListener();

    // Create the RPC listener with centralized message handling
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        // Emit `iframeLifecycle: "connected"` as soon as i18n is initialized
        // so the partner UX contract — "if I emit ready, a click on a
        // modal-triggering button must just work" — is honored. i18n is
        // normally ready by the time this effect runs (resources are bundled,
        // init is effectively synchronous), but we still subscribe to the
        // event in case we lost the race.
        //
        // `emitConnected` is also wired up as the heartbeat callback below:
        // calling it multiple times is safe because
        // `iframeLifecycle: "connected"` is idempotent on the SDK side
        // (`isConnectedDeferred.resolve` only triggers once, telemetry has
        // its own `settled` flag). That's why we purposely do not guard these
        // emits — the heartbeat is the recovery path if our first emit races
        // the SDK's message-listener attach, or if version skew during a
        // deployment leaves us talking to an SDK that only pings.
        const emitWhenI18nReady = () => {
            if (i18next.isInitialized) {
                emitConnected();
                return;
            }
            i18next.on("initialized", emitConnected);
        };

        // Create the listener with combined schema (IFrame + SSO)
        // This listener handles:
        // - IFrameRpcSchema: SDK iframe -> wallet communication
        // - SsoRpcSchema: SSO window -> wallet communication
        //
        // Note: We accept all origins with "*" because the actual security validation
        // happens in walletContextMiddleware (matching merchantId from origin
        // against stored iframeResolvingContext)
        //
        // Message routing:
        // 1. Lifecycle messages -> clientLifecycleHandler (no middleware)
        // 2. RPC messages -> middleware stack -> handlers
        //
        // Middleware stack order (RPC messages only):
        // 1. loggingMiddleware - Logs requests/responses (development only)
        // 2. walletContextMiddleware - Augments context with merchantId, sourceUrl, etc.
        const listener = createRpcListener<
            CombinedRpcSchema,
            WalletRpcContext,
            FrakLifecycleEvent
        >({
            transport: window,
            allowedOrigins: "*",
            middleware: [loggingMiddleware, walletContextMiddleware],
            lifecycleHandlers: {
                clientLifecycle: clientLifecycleHandler,
            },
        });

        // Register promise-based handlers (IFrameRpcSchema)
        listener.handle("frak_displayModal", onDisplayModalRequest);
        listener.handle("frak_prepareSso", handlePrepareSso);
        listener.handle("frak_openSso", handleOpenSso);
        listener.handle(
            "frak_getMerchantInformation",
            onGetMerchantInformation
        );
        listener.handle("frak_displayEmbeddedWallet", onDisplayEmbeddedWallet);
        listener.handle("frak_sendInteraction", onSendInteraction);
        listener.handle("frak_getUserReferralStatus", onGetUserReferralStatus);
        listener.handle("frak_displaySharingPage", onDisplaySharingPage);
        listener.handle("frak_getMergeToken", onGetMergeToken);

        // Register streaming handlers (IFrameRpcSchema)
        listener.handleStream(
            "frak_listenToWalletStatus",
            onWalletListenRequest
        );

        // Register SSO handlers (SsoRpcSchema)
        listener.handle("sso_complete", handleSsoComplete);

        // All handlers are wired up — signal readiness to the SDK.
        emitWhenI18nReady();

        // On cleanup, destroy the listener
        return () => {
            i18next.off("initialized", emitConnected);
            listener.cleanup();
        };
    }, [
        onWalletListenRequest,
        onDisplayModalRequest,
        onGetMerchantInformation,
        onGetUserReferralStatus,
        onGetMergeToken,
        onDisplayEmbeddedWallet,
        onDisplaySharingPage,
        onSendInteraction,
    ]);

    /**
     * Add a data attribute to the root element to style the layout
     */
    useEffect(() => {
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.dataset.listener = "true";
        }

        return () => {
            rootElement.dataset.listener = "false";
        };
    }, []);

    /**
     * Send a ping to the metrics server
     */
    useSendPing();

    /**
     * Preload a few data
     */
    useListenerDataPreload();

    return <ListenerUiRenderer />;
}
