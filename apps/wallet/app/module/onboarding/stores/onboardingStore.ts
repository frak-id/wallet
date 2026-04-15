import { create } from "zustand";
import { persist } from "zustand/middleware";

type OnboardingState = {
    slideIndex: number;
};

type OnboardingActions = {
    setSlideIndex: (index: number) => void;
    resetSlideIndex: () => void;
};

export const onboardingStore = create<OnboardingState & OnboardingActions>()(
    persist(
        (set) => ({
            slideIndex: 0,
            setSlideIndex: (index) => set({ slideIndex: index }),
            resetSlideIndex: () => set({ slideIndex: 0 }),
        }),
        {
            name: "frak_onboarding_store",
            partialize: (state) => ({ slideIndex: state.slideIndex }),
        }
    )
);

export const selectSlideIndex = (state: OnboardingState & OnboardingActions) =>
    state.slideIndex;

export const selectSetSlideIndex = (
    state: OnboardingState & OnboardingActions
) => state.setSlideIndex;

export const selectResetSlideIndex = (
    state: OnboardingState & OnboardingActions
) => state.resetSlideIndex;
