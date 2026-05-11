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

            // Close the topmost modal as a side effect of any navigation
            // while one is open — leaving stale overlays hovering over a
            // freshly-navigated route is broken UX.
            state.closeModal();

            // BACK: closing the modal IS the user's intent; block the
            // actual history change so back doesn't also navigate away.
            // PUSH/REPLACE/FORWARD/GO (e.g. deep-link handlers calling
            // `router.navigate`): let the navigation proceed — returning
            // true here would silently drop it in @tanstack/history's
            // `tryNavigation`, which is exactly the deep-link-arrived-but-
            // route-didn't-change bug we're fixing.
            return action === "BACK";
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
