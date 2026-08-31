import { IS_ANDROID } from "@frak-labs/app-essentials/utils/platform";
import { useBlocker } from "@tanstack/react-router";
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
        shouldBlockFn: ({ action }) => {
            const state = modalStore.getState();
            if (!state.modal) return false;

            // BACK: closing the modal IS the user's intent, so dismiss it —
            // running the opener's exit — and block the history change so
            // back doesn't also navigate away.
            if (action === "BACK") {
                state.closeModal();
                return true;
            }

            // PUSH/REPLACE/FORWARD/GO (e.g. deep-link handlers calling
            // `router.navigate`): the navigation is already going where the
            // caller wants, so clear the overlay without running any exit —
            // that would fire a second, competing navigation. Returning true
            // here would instead silently drop the push in
            // @tanstack/history's `tryNavigation`.
            state.dismissAll();
            return false;
        },
        enableBeforeUnload: false,
        disabled: !hasModal,
    });

    // Handle Tauri Android hardware back button.
    // Only registered while a modal is open — when unregistered,
    // AppPlugin's default behavior handles goBack / exit natively.
    //
    // The `IS_ANDROID` constant is the single gate. iOS has no hardware back
    // button and the Tauri `app` plugin doesn't expose `back-button` on iOS,
    // so calling `onBackButtonPress` there triggers an ACL rejection. In
    // web/listener/iOS builds the constant collapses to `false`, so this
    // effect (including the dynamic `@tauri-apps/api/app` import) is
    // dead-code-eliminated by Rolldown.
    useEffect(() => {
        if (!IS_ANDROID || !hasModal) return;

        const listenerPromise = import("@tauri-apps/api/app").then(
            ({ onBackButtonPress }) =>
                onBackButtonPress((payload) => {
                    const state = modalStore.getState();
                    if (state.modal) {
                        state.closeModal();
                    } else if (payload.canGoBack) {
                        // Fallback for the narrow window between last modal
                        // closing and the listener being unregistered.
                        window.history.back();
                    }
                })
        );

        return () => {
            listenerPromise.then((listener) => listener.unregister());
        };
    }, [hasModal]);
}
