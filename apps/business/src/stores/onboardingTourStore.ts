import { create } from "zustand";
import { persist } from "zustand/middleware";
import { welcomePopupStore } from "./welcomePopupStore";

export type TourId =
    | "welcome"
    | "stores"
    | "campaignsOverview"
    | "campaignsList"
    | "campaignWizard"
    | "storeWizard"
    | "members"
    | "push"
    | "pushCreate"
    | "storeEdit"
    | "setupStatus"
    | "settings"
    | "billing";

export type WelcomeTourStatus = "pending" | "completed" | "dismissed";

type OnboardingTourState = {
    welcomeStatus: WelcomeTourStatus;
    activeTour: TourId | null;
    stepIndex: number;
    startTour: (tourId: TourId) => void;
    setStep: (stepIndex: number) => void;
    closeTour: (outcome: "completed" | "dismissed") => void;
    /** Closes the tour without recording an outcome, e.g. when it could not load. */
    abortTour: () => void;
};

/**
 * Guided tour state. Only the outcome of the welcome tour is persisted
 * (browser storage), so it starts once and stays closed after a finish or a
 * skip. A browser that already dismissed the "new dashboard" popup belongs to
 * an existing user and starts as dismissed. Page tours only open on request.
 */
export const onboardingTourStore = create<OnboardingTourState>()(
    persist(
        (set, get) => ({
            welcomeStatus: welcomePopupStore.getState().hasSeenWelcome
                ? "dismissed"
                : "pending",
            activeTour: null,
            stepIndex: 0,
            startTour: (tourId) => set({ activeTour: tourId, stepIndex: 0 }),
            setStep: (stepIndex) => set({ stepIndex }),
            abortTour: () => set({ activeTour: null, stepIndex: 0 }),
            closeTour: (outcome) => {
                const { activeTour, welcomeStatus } = get();
                set({
                    activeTour: null,
                    stepIndex: 0,
                    welcomeStatus:
                        activeTour === "welcome" ? outcome : welcomeStatus,
                });
            },
        }),
        {
            name: "business_onboardingTour_v1",
            partialize: (state) => ({ welcomeStatus: state.welcomeStatus }),
        }
    )
);
