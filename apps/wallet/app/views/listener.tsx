import { ListenerUiRenderer } from "@/module/listener/component/ListerUiRenderer";
import { useDisplayEmbeddedWallet } from "@/module/listener/hooks/useDisplayEmbeddedWallet";
import { useDisplayModalListener } from "@/module/listener/hooks/useDisplayModalListener";
import { useListenerDataPreload } from "@/module/listener/hooks/useListenerDataPreload";
import { useOnGetProductInformation } from "@/module/listener/hooks/useOnGetProductInformation";
import { useOnOpenSso } from "@/module/listener/hooks/useOnOpenSso";
import { useOnTrackSso } from "@/module/listener/hooks/useOnTrackSso";
import { useSendInteractionListener } from "@/module/listener/hooks/useSendInteractionListener";
import { useSendPing } from "@/module/listener/hooks/useSendPing";
import { useWalletStatusListener } from "@/module/listener/hooks/useWalletStatusListener";
import {
    compressionMiddleware,
    loggingMiddleware,
    walletContextMiddleware,
} from "@/module/listener/middleware";
import { ListenerUiProvider } from "@/module/listener/providers/ListenerUiProvider";
import type { WalletRpcContext } from "@/module/listener/types/context";
import { setupLifecycleHandlers } from "@/module/sdk/utils/lifecycleHandlers";
import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import { createRpcListener } from "@frak-labs/rpc";
import { loadPolyfills } from "@frak-labs/ui/utils/polyfills";
import { useEffect, useState } from "react";

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
    const [listener, setListener] = useState<
        | ReturnType<
              typeof createRpcListener<IFrameRpcSchema, WalletRpcContext>
          >
        | undefined
    >(undefined);

    // Hook used when a wallet status is requested
    const onWalletListenRequest = useWalletStatusListener();

    // Hook used when a dashboard action is requested
    const onInteractionRequest = useSendInteractionListener();

    // Hook when a modal display is asked
    const onDisplayModalRequest = useDisplayModalListener();

    // Hook when a embedded wallet display is asked
    const onDisplayEmbeddedWallet = useDisplayEmbeddedWallet();

    // Hook when a modal display is asked
    const onOpenSso = useOnOpenSso();

    // Hook when the client want to track the sso status
    const onTrackSso = useOnTrackSso();

    // Hook when the product information are asked
    const onGetProductInformation = useOnGetProductInformation();

    // Create the RPC listener
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        // Create the listener with schema type and wallet context
        // Note: We accept all origins with "*" because the actual security validation
        // happens in walletContextMiddleware (matching computed productId from origin
        // against stored iframeResolvingContext)
        //
        // Middleware stack order:
        // 1. compressionMiddleware - Decompresses incoming CBOR data with hash validation
        // 2. loggingMiddleware - Logs requests/responses (development only)
        // 3. walletContextMiddleware - Augments context with productId, sourceUrl, etc.
        const newListener = createRpcListener<
            IFrameRpcSchema,
            WalletRpcContext
        >({
            transport: window,
            allowedOrigins: "*",
            middleware: [
                compressionMiddleware,
                loggingMiddleware,
                walletContextMiddleware,
            ],
        });

        // Register promise-based handlers
        newListener.handle("frak_sendInteraction", onInteractionRequest);
        newListener.handle("frak_displayModal", onDisplayModalRequest);
        newListener.handle("frak_sso", onOpenSso);
        newListener.handle(
            "frak_getProductInformation",
            onGetProductInformation
        );
        newListener.handle(
            "frak_displayEmbeddedWallet",
            onDisplayEmbeddedWallet
        );

        // Register streaming handlers
        newListener.handleStream(
            "frak_listenToWalletStatus",
            onWalletListenRequest
        );
        newListener.handleStream("frak_trackSso", onTrackSso);

        setListener(newListener);

        // On cleanup, destroy the listener
        return () => {
            newListener.cleanup();
        };
    }, [
        onWalletListenRequest,
        onInteractionRequest,
        onDisplayModalRequest,
        onOpenSso,
        onTrackSso,
        onGetProductInformation,
        onDisplayEmbeddedWallet,
    ]);

    /**
     * Setup lifecycle handlers and emit ready when context is available
     */
    useEffect(() => {
        if (!listener) {
            return;
        }

        // Setup lifecycle handlers (handshake, heartbeat, etc.)
        const cleanupLifecycle = setupLifecycleHandlers(() => {
            // This callback is called when we're ready to handle requests
            // The lifecycle handlers already emit the "connected" event
        });

        return cleanupLifecycle;
    }, [listener]);

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
