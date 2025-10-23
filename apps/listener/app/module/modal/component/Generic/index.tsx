import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import { trackGenericEvent } from "@frak-labs/wallet-shared/common/analytics";
import { Markdown } from "@frak-labs/wallet-shared/common/component/Markdown";
import { useMemo } from "react";
import styles from "@/module/modal/component/Modal/index.module.css";
import {
    useListenerTranslation,
    useModalListenerUI,
} from "@/module/providers/ListenerUiProvider";
import {
    modalStore,
    selectCurrentStepIndex,
    selectSteps,
} from "@/module/stores/modalStore";

export function MetadataInfo({ description }: { description?: string }) {
    if (description) {
        return (
            <div
                className={`${styles.modalListener__text} ${prefixModalCss("text")}`}
            >
                <Markdown md={description} />
            </div>
        );
    }
    return null;
}

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

        // Build the function used to go to the dismiss step
        const goToDismiss = () => {
            // If the final step is of type reward, jump to final step + 1 (to close the modal)
            const finalStep = steps[finalStepIndex];
            if (
                finalStep?.key === "final" &&
                finalStep?.params?.action?.key === "reward"
            ) {
                // Update the final step and mark it as autoSkip true
                const state = modalStore.getState();
                state.setDismissed(true);
                // Move past the final step to trigger modal close
                modalStore.setState({
                    currentStep: finalStepIndex + 1,
                });
                return;
            }

            // Otherwise, just jump to the last step
            const state = modalStore.getState();
            state.setDismissed(true);
            modalStore.setState({
                currentStep: finalStepIndex,
            });
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
        <button
            type={"button"}
            className={`${styles.modalListener__buttonLink} ${prefixModalCss("button-link")}`}
            onClick={() => {
                goToDismiss();
                trackGenericEvent("modal-dismissed");
            }}
        >
            {t("sdk.modal.dismiss.primaryAction")}
        </button>
    );
}
