import { create } from "zustand";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

type OfflineState = {
    /** Every asset is cached: the demo now runs with no network. */
    ready: boolean;
    /** A newer build took over; reloading picks it up. */
    updateReady: boolean;
    /** Chromium's deferred install prompt, when the browser offers one. */
    installPrompt: InstallPromptEvent | null;
};

export const useOfflineStore = create<OfflineState>(() => ({
    ready: false,
    updateReady: false,
    installPrompt: null,
}));

export function registerServiceWorker() {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        useOfflineStore.setState({
            installPrompt: event as InstallPromptEvent,
        });
    });
    window.addEventListener("appinstalled", () =>
        useOfflineStore.setState({ installPrompt: null })
    );

    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

    // The first takeover of an uncontrolled page is the install, not an update.
    let controlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (controlled) useOfflineStore.setState({ updateReady: true });
        controlled = true;
    });

    navigator.serviceWorker
        .register("./sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => useOfflineStore.setState({ ready: true }))
        .catch((error: unknown) =>
            console.warn("[demo] Offline mode unavailable", error)
        );
}

/** Installed to the home screen, or launched from it. */
export function isStandalone(): boolean {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

/** iOS has no install prompt: the user goes through the share sheet. */
export function isIos(): boolean {
    return (
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
}
