/**
 * Zustand store for modal state management
 */

import type { ModalStepTypes } from "@frak-labs/core-sdk";
import { trackGenericEvent } from "@frak-labs/wallet-shared/common/analytics";
import { create } from "zustand";
import type { AnyModalKey, DisplayedModalStep, ModalStore } from "./types";

/**
 * Modal store managing the complete modal workflow
 */
export const modalStore = create<ModalStore>((set, get) => ({
    // Initial state
    steps: undefined,
    currentStep: 0,
    results: undefined,
    dismissed: false,

    // Actions
    setNewModal: ({ currentStep, initialResult, steps }) => {
        // Append the onResponse callback to each step
        const stepsWithOnResponse = steps.map((step, index) => ({
            ...step,
            onResponse: (
                response: Extract<
                    ModalStepTypes,
                    { key: typeof step.key }
                >["returns"]
            ) => {
                const currentResults = get().results;
                if (!currentResults) return;

                // Update the current results
                set({
                    results: {
                        ...currentResults,
                        [step.key]: response,
                    },
                });

                // Track completion
                trackGenericEvent(`modal_step_${step.key}_completed`);

                // Update the displayed step index
                set({ currentStep: index + 1 });
            },
        })) as DisplayedModalStep<AnyModalKey>[];

        // Set the new modal
        set({
            currentStep,
            steps: stepsWithOnResponse,
            results: initialResult,
            dismissed: false,
        });
    },

    completeStep: (stepKey, response) => {
        const { results, currentStep, steps } = get();
        if (!results || !steps) return;

        // Update results
        set({
            results: {
                ...results,
                [stepKey]: response,
            },
        });

        // Track completion
        trackGenericEvent(`modal_step_${stepKey}_completed`);

        // Move to next step
        set({ currentStep: currentStep + 1 });
    },

    nextStep: () => {
        set((state) => ({ currentStep: state.currentStep + 1 }));
    },

    clearModal: () => {
        set({
            steps: undefined,
            currentStep: 0,
            results: undefined,
            dismissed: false,
        });
    },

    setDismissed: (dismissed) => {
        set({ dismissed });
    },
}));

/**
 * Selector functions for computed values
 */

// Get the current displayed step
export const selectCurrentStep = (state: ModalStore) =>
    state.steps?.[state.currentStep];

// Get the active step index
export const selectActiveStep = (state: ModalStore) => state.currentStep;

// Get the modal results
export const selectResults = (state: ModalStore) => state.results;

// Get the steps
export const selectSteps = (state: ModalStore) => state.steps;

// Check if we should finish (returns results if ready, null if not)
export const selectShouldFinish = (state: ModalStore) => {
    const { steps, currentStep, results, dismissed } = state;

    // If modal is dismissed or cleared (no steps), don't finish
    // This prevents race conditions when rapidly closing/opening modals
    if (!steps || dismissed) return null;

    // First check if we should finish
    let shouldFinish = false;

    // Check if has a displayable step for this index
    const currentStepData = steps[currentStep];
    if (!currentStepData) {
        shouldFinish = true;
    } else {
        // Check if it's a final step and it has auto skip
        shouldFinish =
            currentStepData.key === "final" &&
            currentStepData.params.autoSkip === true;
    }

    // If we don't need to finish, return null
    if (!shouldFinish) return null;

    // Otherwise, return the results
    return results;
};

// Check if the modal is dismissed
export const selectIsDismissed = (state: ModalStore) => state.dismissed;

// Get the displayed steps with current step info
export const selectDisplayedSteps = (state: ModalStore) => {
    const { steps, currentStep, dismissed } = state;
    if (!steps) return undefined;

    return {
        steps,
        currentStep,
        dismissed,
    };
};

// Get just the current step index
export const selectCurrentStepIndex = (state: ModalStore) => state.currentStep;

// Get the current step object at the current index
export const selectCurrentStepObject = (state: ModalStore) => {
    const { steps, currentStep } = state;
    return steps?.[currentStep];
};
