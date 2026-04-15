import { useBlocker } from "@tanstack/react-router";
import { onBackButtonPress } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { modalStore } from "@/module/stores/modalStore";

/**
 * Intercepts back navigation (browser & Tauri Android) so that
 * pressing back pops the modal stack instead of navigating away.
 *
 * Uses TanStack Router's navigation blocker for browser back,
 * and Tauri's `onBackButtonPress` for the Android hardware button.
 *
 * On Tauri, the listener is only registered while a modal is open.
 * When unregistered, AppPlugin falls back to its native default
 * (webView.goBack or activity.finish), so navigation and app-exit
 * work without any JS involvement.
 *
 * TODO: Replace this workaround with proper parallel routing once
 * https://github.com/TanStack/router/pull/6302 lands.
 */
export function useHardwareBack() {
    // Only activate the blocker when a modal is open, so that
    // normal back-press behavior (e.g. closing the app) is preserved.
    const hasModal = modalStore((s) => !!s.modal);

    useBlocker({
        shouldBlockFn: () => {
            const state = modalStore.getState();
            if (state.modal) {
                state.closeModal();
                return true;
            }
            return false;
        },
        enableBeforeUnload: false,
        disabled: !hasModal,
    });

    // Handle Tauri Android hardware back button.
    // Only registered while a modal is open — when unregistered,
    // AppPlugin's default behavior handles goBack / exit natively.
    useEffect(() => {
        if (!isTauri() || !hasModal) return;

        const listenerPromise = onBackButtonPress((payload) => {
            const state = modalStore.getState();
            if (state.modal) {
                state.closeModal();
            } else if (payload.canGoBack) {
                // Fallback for the narrow window between last modal
                // closing and the listener being unregistered.
                window.history.back();
            }
        });

        return () => {
            listenerPromise.then((listener) => listener.unregister());
        };
    }, [hasModal]);
}
