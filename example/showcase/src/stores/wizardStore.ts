import { create } from "zustand";
import { persist } from "zustand/middleware";

type WizardStep = 1 | 2 | 3;

type WizardStore = {
    currentStep: WizardStep;
    nextStep: () => void;
    previousStep: () => void;
    goToStep: (step: WizardStep) => void;
};

export const useWizardStore = create<WizardStore>()(
    persist(
        (set) => ({
            currentStep: 1,
            nextStep: () =>
                set((state) => ({
                    currentStep: Math.min(
                        3,
                        state.currentStep + 1
                    ) as WizardStep,
                })),
            previousStep: () =>
                set((state) => ({
                    currentStep: Math.max(
                        1,
                        state.currentStep - 1
                    ) as WizardStep,
                })),
            goToStep: (step) => set({ currentStep: step }),
        }),
        {
            name: "frak-example-wizard",
            onRehydrateStorage: () => (_state, error) => {
                if (error) {
                    console.error("Failed to rehydrate wizard state:", error);
                }
            },
        }
    )
);
