import { Button } from "@frak-labs/design-system/components/Button";
import { prefixModalCss } from "@frak-labs/wallet-shared/common";
import { useMemo } from "react";
import {
    modalStore,
    selectCurrentStepIndex,
    selectSteps,
} from "@/module/stores/modalStore";
import {
    useListenerTranslation,
    useModalListenerUI,
} from "@/ui/ListenerUiProvider";

/**
 * A generic dismiss button, if possible with the current request
 */
export function DismissButton() {
    const { t } = useListenerTranslation();
    const {
        currentRequest: { metadata },
    } = useModalListenerUI();
    const steps = modalStore(selectSteps);
    const currentStep = modalStore(selectCurrentStepIndex);

    const { info, goToDismiss } = useMemo(() => {
        const empty = { info: null, goToDismiss: null };
        if (!(steps && metadata)) return empty;

        // Ensure it's dismissable and we got a final modal
        const finalStepIndex = steps.findIndex((step) => step.key === "final");
        if (!metadata?.isDismissible || finalStepIndex === -1) return empty;
        if (finalStepIndex === currentStep) return empty;

        const info = {
            index: finalStepIndex,
        };

        // Use the new atomic dismissModal action from the store
        // This ensures dismissed flag and currentStep are updated atomically
        const goToDismiss = () => {
            modalStore.getState().dismissModal();
        };

        return {
            info,
            goToDismiss,
        };
    }, [metadata, steps, currentStep]);

    // If not dismissible, or no dismiss step, return null
    if (!info) return null;

    // Otherwise, button that dismiss the current modal
    return (
        <Button
            variant="ghost"
            width="full"
            className={prefixModalCss("button-link")}
            onClick={goToDismiss}
        >
            {t("sdk.modal.dismiss.primaryAction")}
        </Button>
    );
}
