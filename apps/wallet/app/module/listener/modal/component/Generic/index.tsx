import { Markdown } from "@/module/common/component/Markdown";
import { displayedRpcModalStepsAtom } from "@/module/listener/modal/atoms/modalEvents";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import {
    useListenerTranslation,
    useModalListenerUI,
} from "@/module/listener/providers/ListenerUiProvider";
import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import { useAtom } from "jotai";
import { useMemo } from "react";
import { trackGenericEvent } from "../../../../common/analytics";

export function MetadataInfo({
    description,
}: {
    description?: string;
}) {
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
    const [modalSteps, setModalSteps] = useAtom(displayedRpcModalStepsAtom);

    const { info, goToDismiss } = useMemo(() => {
        const empty = { info: null, goToDismiss: null };
        if (!(modalSteps && metadata)) return empty;

        // Ensure it's dismissable and we got a final modal
        const finalStepIndex = modalSteps.steps.findIndex(
            (step) => step.key === "final"
        );
        if (!metadata?.isDismissible || finalStepIndex === -1) return empty;
        if (finalStepIndex === modalSteps.currentStep) return empty;

        const info = {
            index: finalStepIndex,
        };

        // Build the function used to go to the dismiss step
        const goToDismiss = () => {
            // If the final step is of type reward, jump to final step + 1 (to close the modal)
            const finalStep = modalSteps.steps[finalStepIndex];
            if (
                finalStep?.key === "final" &&
                finalStep?.params?.action?.key === "reward"
            ) {
                // Update the final step and mark it as autoSkip true
                setModalSteps({
                    ...modalSteps,
                    currentStep: finalStepIndex + 1,
                    dismissed: true,
                });
                return;
            }

            // Otherwise, just jump to the last step
            setModalSteps({
                ...modalSteps,
                currentStep: finalStepIndex,
                dismissed: true,
            });
        };

        return {
            info,
            goToDismiss,
        };
    }, [metadata, modalSteps, setModalSteps]);

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
