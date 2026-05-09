import { lazy, useEffect } from "react";
import { useListenerUI } from "@/module/providers/ListenerUiProvider";

/**
 * Lazy import of the modal UI
 */
const modalImport = () =>
    import("@/module/modal/component/Modal").then((module) => ({
        default: module.ListenerModal,
    }));
const ListenerModal = lazy(modalImport);

/**
 * Lazy import of the embedded wallet UI
 */
const walletImport = () =>
    import("@/module/embedded/component/Wallet").then((module) => ({
        default: module.ListenerWallet,
    }));
const ListenerWallet = lazy(walletImport);

/**
 * Lazy import of the sharing page UI
 */
const sharingImport = () =>
    import("@/module/sharing/component/SharingPage").then((module) => ({
        default: module.ListenerSharingPage,
    }));
const ListenerSharingPage = lazy(sharingImport);

/**
 * Lazy import of the modal hook impl (paired with the modal view).
 * Same module specifier as the dynamic import inside `useDisplayModalListener`,
 * so the bundler resolves both call sites to the same chunk.
 */
const modalHookImport = () =>
    import("@/module/hooks/useDisplayModalListener.impl");

/**
 * Lazy import of the sharing hook impl (paired with the sharing view).
 */
const sharingHookImport = () =>
    import("@/module/hooks/useDisplaySharingPageListener.impl");

/**
 * Render the listener UI if needed
 */
export function ListenerUiRenderer() {
    const { currentRequest } = useListenerUI();

    /**
     * Preload the modal + sharing page (and their RPC handler impls) so
     * the first display is not gated on a network round-trip on slow links.
     */
    useEffect(() => {
        const hash = window.location.hash.slice(1);
        const urlParams = new URLSearchParams(hash);
        const preloadRaw = urlParams.get("preload");
        // No preload parameter -> do nothing
        if (!preloadRaw) {
            return;
        }

        const preloads = preloadRaw.split(",");
        const shouldPreloadModal = preloads.includes("modal");
        const shouldPreloadSharing = preloads.includes("sharing");

        if (!shouldPreloadModal && !shouldPreloadSharing) {
            return;
        }

        const handleIdleCallback = async () => {
            if (shouldPreloadModal) {
                await Promise.all([modalImport(), modalHookImport()]);
            }
            if (shouldPreloadSharing) {
                await Promise.all([sharingImport(), sharingHookImport()]);
            }
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
     * If the request is an embedded wallet, display it
     */
    if (currentRequest.type === "embedded") {
        return <ListenerWallet />;
    }

    /**
     * If the request is a sharing page, display it
     */
    if (currentRequest.type === "sharing") {
        return <ListenerSharingPage />;
    }

    /**
     * If the request is a modal, display it
     */
    return <ListenerModal {...currentRequest} />;
}
