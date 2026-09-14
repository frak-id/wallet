import { trackEvent } from "@frak-labs/wallet-shared/common/analytics";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/common/utils/lifecycleEvents";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { modalStore } from "@/module/stores/modalStore";
import { useListenerUI } from "@/ui/ListenerUiProvider";

/**
 * Hook used to trigger a cleanup of the SDK
 */
export function useSdkCleanup() {
    const { currentRequest } = useListenerUI();
    const queryClient = useQueryClient();

    return useCallback(() => {
        trackEvent("sdk_cleaned_up");

        // Remove backup data from the client website
        emitLifecycleEvent(
            { iframeLifecycle: "remove-backup" },
            { targetOrigin: "*" }
        );

        sessionStore.getState().setSession(null);
        sessionStore.getState().setSdkSession(null);

        localStorage.clear();
        queryClient.clear();

        // Read the store directly so the callback identity stays stable.
        const currentModalSteps = modalStore.getState();
        if (!currentRequest || !currentModalSteps.steps) {
            return;
        }

        // A modal past the login step must go back to it after a cleanup.
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
