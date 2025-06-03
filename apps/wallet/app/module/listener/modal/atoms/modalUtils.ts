import { atom } from "jotai";
import { displayedRpcModalStepsAtom, modalRpcResultsAtom } from "./modalEvents";

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
 * Clear the current rpc modal
 */
export const clearRpcModalAtom = atom(null, (_get, set) => {
    set(modalRpcResultsAtom, undefined);
    set(displayedRpcModalStepsAtom, undefined);
});
