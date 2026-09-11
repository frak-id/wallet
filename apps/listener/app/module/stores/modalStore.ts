/**
 * Zustand store for modal state management
 */

import type { ModalStepTypes } from "@frak-labs/core-sdk";
import {
    type ModalDismissSource,
    trackEvent,
} from "@frak-labs/wallet-shared/common/analytics";
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

                // Move to next step (step completion is inferred from the
                // next step's `modal_step_viewed` event in the Modal component)
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

    clearModal: () => {
        set({
            steps: undefined,
            currentStep: 0,
            results: undefined,
            dismissed: false,
        });
    },

    dismissModal: (source: ModalDismissSource = "close_btn") => {
        const { steps, currentStep } = get();

        // Find the final step
        const finalStepIndex =
            steps?.findIndex((step) => step.key === "final") ?? -1;

        const lastStep = steps?.[currentStep]?.key;

        if (finalStepIndex === -1 || !steps) {
            // No final step found, just mark as dismissed
            set({ dismissed: true });
            trackEvent("modal_dismissed", {
                last_step: lastStep,
                completed: false,
                source,
            });
            return;
        }

        // Check if final step is a reward step (should skip past it)
        const finalStep = steps[finalStepIndex];
        const isRewardStep =
            finalStep?.key === "final" &&
            finalStep?.params?.action?.key === "reward";

        // Atomic update: set dismissed and move to appropriate step
        // If reward step, move past it to trigger close
        // Otherwise, move to the final step
        set({
            dismissed: true,
            currentStep: isRewardStep ? finalStepIndex + 1 : finalStepIndex,
        });

        trackEvent("modal_dismissed", {
            last_step: lastStep,
            completed: false,
            source,
        });
    },
}));

/**
 * Selector functions for computed values
 */

// Get the current displayed step
export const selectCurrentStep = (state: ModalStore) =>
    state.steps?.[state.currentStep];

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

// Get just the current step index
export const selectCurrentStepIndex = (state: ModalStore) => state.currentStep;
