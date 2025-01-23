import { lazy, useEffect } from "react";
import { useListenerUI } from "../providers/ListenerUiProvider";

/**
 * Lazy import of the modal UI
 */
const modalImport = () =>
    import("@/module/listener/modal/component/Modal").then((module) => ({
        default: module.ListenerModal,
    }));
const ListenerModal = lazy(modalImport);

/**
 * Lazy import of the embeded wallet UI
 */
const walletImport = () =>
    import("@/module/listener/embeded/component/Wallet").then((module) => ({
        default: module.ListenerWallet,
    }));
const ListenerWallet = lazy(walletImport);

/**
 * Render the listener UI if needed
 */
export function ListenerUiRenderer() {
    const { currentRequest } = useListenerUI();

    /**
     * Preload the modal + embeded wallet so it did not take too much time to display on slow network
     */
    useEffect(() => {
        const handleIdleCallback = async () => {
            await modalImport();
            await walletImport();
        };

        if ("requestIdleCallback" in window) {
            const idleCallbackId = requestIdleCallback(handleIdleCallback);
            return () => cancelIdleCallback(idleCallbackId);
        }

        const timeoutId = setTimeout(handleIdleCallback, 0);
        return () => clearTimeout(timeoutId);
    }, []);

    /**
     * If no request, do not display anything
     */
    if (!currentRequest) {
        return null;
    }

    /**
     * If the request is an embeded wallet, display it
     */
    if (currentRequest.type === "embeded") {
        return <ListenerWallet />;
        // return <ListenerWallet params={currentRequest.params} />;
    }

    /**
     * If the request is a modal, display it
     */
    return <ListenerModal />;
}
