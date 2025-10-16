import { ListenerUiRenderer } from "@/module/listener/component/ListerUiRenderer";
import {
    checkContextAndEmitReady,
    createClientLifecycleHandler,
    initializeResolvingContext,
} from "@/module/listener/handlers/lifecycleHandler";
import {
    handleOpenSso,
    handlePrepareSso,
    handleSsoComplete,
} from "@/module/listener/handlers/ssoHandler";
import { useDisplayEmbeddedWallet } from "@/module/listener/hooks/useDisplayEmbeddedWallet";
import { useDisplayModalListener } from "@/module/listener/hooks/useDisplayModalListener";
import { useListenerDataPreload } from "@/module/listener/hooks/useListenerDataPreload";
import { useOnGetProductInformation } from "@/module/listener/hooks/useOnGetProductInformation";
import { useSendInteractionListener } from "@/module/listener/hooks/useSendInteractionListener";
import { useSendPing } from "@/module/listener/hooks/useSendPing";
import { useWalletStatusListener } from "@/module/listener/hooks/useWalletStatusListener";
import {
    loggingMiddleware,
    walletContextMiddleware,
} from "@/module/listener/middleware";
import { ListenerUiProvider } from "@/module/listener/providers/ListenerUiProvider";
import type {
    CombinedRpcSchema,
    WalletRpcContext,
} from "@/module/listener/types/context";
import type { FrakLifecycleEvent } from "@frak-labs/core-sdk";
import {
    createListenerCompressionMiddleware,
    createRpcListener,
} from "@frak-labs/frame-connector";
import { loadPolyfills } from "@frak-labs/ui/utils/polyfills";
import { useEffect } from "react";

loadPolyfills();

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

    // Hook used when a dashboard action is requested
    const onInteractionRequest = useSendInteractionListener();

    // Hook when a modal display is asked
    const onDisplayModalRequest = useDisplayModalListener();

    // Hook when a embedded wallet display is asked
    const onDisplayEmbeddedWallet = useDisplayEmbeddedWallet();

    // Hook when the product information are asked
    const onGetProductInformation = useOnGetProductInformation();

    // Create the RPC listener with centralized message handling
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        // Track if we're ready to handle requests
        let isReady = false;
        const setReadyToHandleRequest = () => {
            if (isReady) return;
            isReady = true;
            checkContextAndEmitReady();
        };

        // Create lifecycle handler
        const clientLifecycleHandler = createClientLifecycleHandler(
            setReadyToHandleRequest
        );

        // Create the listener with combined schema (IFrame + SSO)
        // This listener handles:
        // - IFrameRpcSchema: SDK iframe -> wallet communication
        // - SsoRpcSchema: SSO window -> wallet communication
        //
        // Note: We accept all origins with "*" because the actual security validation
        // happens in walletContextMiddleware (matching computed productId from origin
        // against stored iframeResolvingContext)
        //
        // Message routing:
        // 1. Lifecycle messages -> clientLifecycleHandler (no middleware, no compression)
        // 2. RPC messages -> middleware stack -> handlers
        //
        // Middleware stack order (RPC messages only):
        // 1. compressionMiddleware - Decompresses incoming CBOR data with hash validation
        // 2. loggingMiddleware - Logs requests/responses (development only)
        // 3. walletContextMiddleware - Augments context with productId, sourceUrl, etc.
        const listener = createRpcListener<
            CombinedRpcSchema,
            WalletRpcContext,
            FrakLifecycleEvent
        >({
            transport: window,
            allowedOrigins: "*",
            middleware: [
                createListenerCompressionMiddleware(),
                loggingMiddleware,
                walletContextMiddleware,
            ],
            lifecycleHandlers: {
                clientLifecycle: clientLifecycleHandler,
            },
        });

        // Register promise-based handlers (IFrameRpcSchema)
        listener.handle("frak_sendInteraction", onInteractionRequest);
        listener.handle("frak_displayModal", onDisplayModalRequest);
        listener.handle("frak_prepareSso", handlePrepareSso);
        listener.handle("frak_openSso", handleOpenSso);
        listener.handle("frak_getProductInformation", onGetProductInformation);
        listener.handle("frak_displayEmbeddedWallet", onDisplayEmbeddedWallet);

        // Register streaming handlers (IFrameRpcSchema)
        listener.handleStream(
            "frak_listenToWalletStatus",
            onWalletListenRequest
        );

        // Register SSO handlers (SsoRpcSchema)
        listener.handle("sso_complete", handleSsoComplete);

        // Initialize resolving context (starts handshake if needed)
        initializeResolvingContext();

        // On cleanup, destroy the listener
        return () => {
            listener.cleanup();
        };
    }, [
        onWalletListenRequest,
        onInteractionRequest,
        onDisplayModalRequest,
        onGetProductInformation,
        onDisplayEmbeddedWallet,
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
