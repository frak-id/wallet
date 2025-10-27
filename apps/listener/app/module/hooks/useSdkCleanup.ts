import {
    emitLifecycleEvent,
    sessionStore,
    trackGenericEvent,
} from "@frak-labs/wallet-shared";
import { WebAuthnAbortService } from "@simplewebauthn/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { modalStore } from "@/module/stores/modalStore";
import { useListenerUI } from "../providers/ListenerUiProvider";

/**
 * Hook used to trigger a cleanup of the SDK
 */
export function useSdkCleanup() {
    const { currentRequest } = useListenerUI();
    const queryClient = useQueryClient();

    return useCallback(() => {
        trackGenericEvent("sdk-cleanup");
        // Cancel any pending webauthn request
        WebAuthnAbortService.cancelCeremony();

        // Remove backup data from the client website
        emitLifecycleEvent({
            iframeLifecycle: "remove-backup",
        });

        // Clean the session store, this will force a rerender on the displayed component depending on it
        sessionStore.getState().setSession(null);
        sessionStore.getState().setSdkSession(null);

        // Remove all the iframe local storage
        localStorage.clear();

        // Clear tanstack side
        queryClient.clear();

        // Get current modal state directly from store (avoid dependency array issues)
        const currentModalSteps = modalStore.getState();

        // If we don't have anything displayed, or it's not the modal displayed
        if (!currentRequest || !currentModalSteps.steps) {
            return;
        }

        // If we are displaying a modal, and it's not the login page, we need to go back to the login page
        const loginStep = currentModalSteps.steps.findIndex(
            (step) => step.key === "login"
        );
        if (loginStep !== -1 && loginStep < currentModalSteps.currentStep) {
            modalStore.setState({
                currentStep: loginStep,
            });
        }
    }, [queryClient, currentRequest]);
}
