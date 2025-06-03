import { jotaiStore } from "@frak-labs/shared/module/atoms/store";
import { WebAuthnAbortService } from "@simplewebauthn/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { RESET } from "jotai/utils";
import { useCallback } from "react";
import { sdkSessionAtom, sessionAtom } from "../../common/atoms/session";
import { emitLifecycleEvent } from "../../sdk/utils/lifecycleEvents";
import { displayedRpcModalStepsAtom } from "../modal/atoms/modalEvents";
import { useListenerUI } from "../providers/ListenerUiProvider";

/**
 * Hook used to trigger a cleanup of the SDK
 */
export function useSdkCleanup() {
    const { currentRequest } = useListenerUI();
    const [currentModalSteps, setCurrentModalSteps] = useAtom(
        displayedRpcModalStepsAtom
    );
    const queryClient = useQueryClient();

    return useCallback(() => {
        // Cancel any pending webauthn request
        WebAuthnAbortService.cancelCeremony();

        // Remove backup data from the client website
        emitLifecycleEvent({
            iframeLifecycle: "remove-backup",
        });

        // Clean the jotai session atom, this will force a rerender on the displayed component depending on it
        jotaiStore.set(sessionAtom, RESET);
        jotaiStore.set(sdkSessionAtom, RESET);

        // Remove all the iframe local storage
        localStorage.clear();

        // Clear tanstack side
        queryClient.clear();

        // If we don't have anything displayed, or it's not the modal displayed
        if (!currentRequest || !currentModalSteps) {
            return;
        }

        // If we are displaying a modal, and it's not the login page, we need to go back to the login page
        const loginStep = currentModalSteps.steps.findIndex(
            (step) => step.key === "login"
        );
        if (loginStep !== -1 && loginStep < currentModalSteps.currentStep) {
            setCurrentModalSteps({
                ...currentModalSteps,
                currentStep: loginStep,
            });
        }
    }, [queryClient, currentRequest, currentModalSteps, setCurrentModalSteps]);
}
