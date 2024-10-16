import { atom } from "jotai";
import {
    displayedRpcModalStepsAtom,
    modalDisplayedRequestAtom,
    modalRpcResultsAtom,
} from "./modalEvents";

/**
 * The currently displayed modal step
 */
export const currentDisplayedStepAtom = atom((get) => {
    const steps = get(displayedRpcModalStepsAtom);
    return steps?.steps[steps.currentStep];
});

/**
 * Get the active steps atom
 */
export const activeStepAtom = atom(
    (get) => get(displayedRpcModalStepsAtom)?.currentStep ?? 0
);

/**
 * Small atom to check if we should trigger the onFinish event
 */
export const onFinishResultAtom = atom((get) => {
    const steps = get(displayedRpcModalStepsAtom);

    // First check if we should finish
    let shouldFinish = false;

    // Check if has a displayable step for this index
    const currentStep = steps?.steps[steps.currentStep];
    if (!currentStep) {
        shouldFinish = true;
    } else {
        // Check if it's a final step and it has auto skip
        shouldFinish =
            currentStep.key === "final" && currentStep.params.autoSkip === true;
    }

    // If we don't need to finish, return null
    if (!shouldFinish) return null;

    // Otherwise, get the results
    return get(modalRpcResultsAtom);
});

/**
 * Check if the current modal is dismissed
 */
export const isModalDismissedAtom = atom(
    (get) => get(displayedRpcModalStepsAtom)?.dismissed ?? false
);

/**
 * Go to the dismissed step in the modal
 */
export const dismissModalBtnAtom = atom(
    (get) => {
        // Get some info for the dismiss btn
        const modalSteps = get(displayedRpcModalStepsAtom);
        const modalRequest = get(modalDisplayedRequestAtom);
        if (!(modalSteps && modalRequest)) return null;

        // Ensure it's dismissable and we got a final modal
        const metadata = modalRequest.metadata;
        const finalStepIndex = modalSteps.steps.findIndex(
            (step) => step.key === "final"
        );
        if (!metadata?.isDismissible || finalStepIndex === -1) return null;
        if (finalStepIndex === modalSteps.currentStep) return null;

        return {
            customLbl: metadata.dismissActionTxt,
            index: finalStepIndex,
        };
    },
    (get, set) => {
        // Check if we can dismiss the current modal
        const modalSteps = get(displayedRpcModalStepsAtom);
        if (!modalSteps) return null;
        const finalStepIndex = modalSteps.steps.findIndex(
            (step) => step.key === "final"
        );

        // If not dismissible, or no final step, return null
        if (finalStepIndex === -1 || finalStepIndex === modalSteps.currentStep)
            return;

        set(displayedRpcModalStepsAtom, {
            ...modalSteps,
            currentStep: finalStepIndex,
            dismissed: true,
        });
    }
);

/**
 * Clear the current rpc modal
 */
export const clearRpcModalAtom = atom(null, (_get, set) => {
    set(modalDisplayedRequestAtom, null);
    set(modalRpcResultsAtom, undefined);
    set(displayedRpcModalStepsAtom, undefined);
});
