import { beforeEach, describe, expect, it, vi } from "vitest";
import { onboardingTourStore } from "./onboardingTourStore";

const STORAGE_KEY = "business_onboardingTour_v1";

describe("onboardingTourStore", () => {
    beforeEach(() => {
        localStorage.clear();
        onboardingTourStore.setState({
            welcomeStatus: "pending",
            activeTour: null,
            stepIndex: 0,
        });
    });

    it("starts a tour on its first step", () => {
        onboardingTourStore.getState().setStep(3);
        onboardingTourStore.getState().startTour("stores");

        expect(onboardingTourStore.getState().activeTour).toBe("stores");
        expect(onboardingTourStore.getState().stepIndex).toBe(0);
    });

    it("remembers a finished welcome tour", () => {
        onboardingTourStore.getState().startTour("welcome");
        onboardingTourStore.getState().closeTour("completed");

        expect(onboardingTourStore.getState().welcomeStatus).toBe("completed");
        expect(onboardingTourStore.getState().activeTour).toBeNull();
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
            state: { welcomeStatus: "completed" },
            version: 0,
        });
    });

    it("remembers a skipped welcome tour", () => {
        onboardingTourStore.getState().startTour("welcome");
        onboardingTourStore.getState().closeTour("dismissed");

        expect(onboardingTourStore.getState().welcomeStatus).toBe("dismissed");
    });

    it("does not change the welcome status when a page tour closes", () => {
        onboardingTourStore.getState().startTour("members");
        onboardingTourStore.getState().closeTour("completed");

        expect(onboardingTourStore.getState().welcomeStatus).toBe("pending");
    });

    it("records the new outcome when the welcome tour is replayed", () => {
        onboardingTourStore.setState({ welcomeStatus: "dismissed" });
        onboardingTourStore.getState().startTour("welcome");
        onboardingTourStore.getState().closeTour("completed");

        expect(onboardingTourStore.getState().welcomeStatus).toBe("completed");
    });

    describe("first visit", () => {
        beforeEach(() => {
            localStorage.clear();
        });

        const loadFreshStore = async () => {
            vi.resetModules();
            const mod = await import("./onboardingTourStore");
            return mod.onboardingTourStore;
        };

        it("is pending for a user who has not seen the announcement", async () => {
            const store = await loadFreshStore();

            expect(store.getState().welcomeStatus).toBe("pending");
        });

        it("is already dismissed for an existing user", async () => {
            localStorage.setItem(
                "business_welcomePopup_v1",
                JSON.stringify({
                    state: { hasSeenWelcome: true },
                    version: 0,
                })
            );
            const store = await loadFreshStore();

            expect(store.getState().welcomeStatus).toBe("dismissed");
        });

        it("restores the saved status", async () => {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    state: { welcomeStatus: "completed" },
                    version: 0,
                })
            );
            const store = await loadFreshStore();

            expect(store.getState().welcomeStatus).toBe("completed");
        });
    });
});
