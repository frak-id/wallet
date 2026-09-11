import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import {
    modalStore,
    selectCurrentStep,
    selectCurrentStepIndex,
    selectIsDismissed,
    selectShouldFinish,
} from "./modalStore";

// Mock wallet-shared imports
vi.mock("@frak-labs/wallet-shared/common/analytics", () => ({
    trackEvent: vi.fn(),
}));

describe("modalStore", () => {
    beforeEach(() => {
        // Reset store state
        modalStore.setState({
            steps: undefined,
            currentStep: 0,
            results: undefined,
            dismissed: false,
        });
        vi.clearAllMocks();
    });

    describe("Initial state", () => {
        test("should have correct initial state", () => {
            const state = modalStore.getState();
            expect(state.steps).toBeUndefined();
            expect(state.currentStep).toBe(0);
            expect(state.results).toBeUndefined();
            expect(state.dismissed).toBe(false);
        });
    });

    describe("setNewModal", () => {
        test("should set new modal with steps and initial results", () => {
            const steps = [
                { key: "login" as const, params: {} as any },
                {
                    key: "final" as const,
                    params: { action: "redirect" } as any,
                },
            ];
            const initialResult = {} as any;

            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult,
                steps,
            });

            const state = modalStore.getState();
            expect(state.steps).toHaveLength(2);
            expect(state.currentStep).toBe(0);
            expect(state.results).toBe(initialResult);
            expect(state.dismissed).toBe(false);
        });

        test("should add onResponse callbacks to each step", () => {
            const steps = [{ key: "login" as const, params: {} as any }];

            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult: {} as any,
                steps,
            });

            const state = modalStore.getState();
            expect(state.steps?.[0].onResponse).toBeDefined();
            expect(typeof state.steps?.[0].onResponse).toBe("function");
        });

        test("should allow setting non-zero initial step", () => {
            const steps = [
                { key: "login" as const, params: {} as any },
                {
                    key: "final" as const,
                    params: { action: "redirect" } as any,
                },
            ];

            modalStore.getState().setNewModal({
                currentStep: 1,
                initialResult: {} as any,
                steps,
            });

            expect(modalStore.getState().currentStep).toBe(1);
        });

        test("should reset dismissed flag when setting new modal", () => {
            modalStore.setState({ dismissed: true });

            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult: {} as any,
                steps: [{ key: "login" as const, params: {} as any }],
            });

            expect(modalStore.getState().dismissed).toBe(false);
        });

        test("should call onResponse to update results and move to next step", () => {
            const steps = [{ key: "login" as const, params: {} as any }];

            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult: {} as any,
                steps,
            });

            const state = modalStore.getState();
            const onResponse = state.steps?.[0].onResponse;

            // Call onResponse with mock response
            onResponse?.({ status: "success" } as any);

            const updatedState = modalStore.getState();
            expect(updatedState.results).toEqual({
                login: { status: "success" },
            });
            expect(updatedState.currentStep).toBe(1);
        });

        test("should not update results if results is undefined when onResponse called", () => {
            const steps = [{ key: "login" as const, params: {} as any }];

            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult: {} as any,
                steps,
            });

            // Manually clear results to simulate edge case
            modalStore.setState({ results: undefined });

            const state = modalStore.getState();
            const onResponse = state.steps?.[0].onResponse;

            // Call onResponse - should return early
            onResponse?.({ status: "success" } as any);

            const updatedState = modalStore.getState();
            expect(updatedState.results).toBeUndefined();
        });
    });

    describe("clearModal", () => {
        test("should reset all modal state", () => {
            modalStore.setState({
                steps: [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                ],
                currentStep: 2,
                results: { login: { status: "success" } } as any,
                dismissed: true,
            });

            modalStore.getState().clearModal();

            const state = modalStore.getState();
            expect(state.steps).toBeUndefined();
            expect(state.currentStep).toBe(0);
            expect(state.results).toBeUndefined();
            expect(state.dismissed).toBe(false);
        });
    });

    describe("dismissModal", () => {
        test("should set dismissed flag when no steps present", async () => {
            const { trackEvent } = await import(
                "@frak-labs/wallet-shared/common/analytics"
            );

            modalStore.setState({ steps: undefined });

            modalStore.getState().dismissModal();

            const state = modalStore.getState();
            expect(state.dismissed).toBe(true);
            expect(trackEvent).toHaveBeenCalledWith("modal_dismissed", {
                last_step: undefined,
                completed: false,
                source: "close_btn",
            });
        });

        test("should set dismissed flag when no final step found", async () => {
            const { trackEvent } = await import(
                "@frak-labs/wallet-shared/common/analytics"
            );

            const steps = [
                {
                    key: "login" as const,
                    params: {} as any,
                    onResponse: vi.fn(),
                },
            ];
            modalStore.setState({ steps: steps as any, currentStep: 0 });

            modalStore.getState().dismissModal();

            const state = modalStore.getState();
            expect(state.dismissed).toBe(true);
            expect(trackEvent).toHaveBeenCalledWith("modal_dismissed", {
                last_step: "login",
                completed: false,
                source: "close_btn",
            });
        });

        test("should atomically set dismissed and move to final step for non-reward", async () => {
            const { trackEvent } = await import(
                "@frak-labs/wallet-shared/common/analytics"
            );

            const steps = [
                {
                    key: "login" as const,
                    params: {} as any,
                    onResponse: vi.fn(),
                },
                {
                    key: "final" as const,
                    params: { action: { key: "success" } } as any,
                    onResponse: vi.fn(),
                },
            ];
            modalStore.setState({ steps: steps as any, currentStep: 0 });

            modalStore.getState().dismissModal();

            const state = modalStore.getState();
            expect(state.dismissed).toBe(true);
            expect(state.currentStep).toBe(1);
            expect(trackEvent).toHaveBeenCalledWith("modal_dismissed", {
                last_step: "login",
                completed: false,
                source: "close_btn",
            });
        });

        test("should atomically set dismissed and skip past reward final step", async () => {
            const { trackEvent } = await import(
                "@frak-labs/wallet-shared/common/analytics"
            );

            const steps = [
                {
                    key: "login" as const,
                    params: {} as any,
                    onResponse: vi.fn(),
                },
                {
                    key: "final" as const,
                    params: { action: { key: "reward" } } as any,
                    onResponse: vi.fn(),
                },
            ];
            modalStore.setState({ steps: steps as any, currentStep: 0 });

            modalStore.getState().dismissModal();

            const state = modalStore.getState();
            expect(state.dismissed).toBe(true);
            expect(state.currentStep).toBe(2);
            expect(trackEvent).toHaveBeenCalledWith("modal_dismissed", {
                last_step: "login",
                completed: false,
                source: "close_btn",
            });
        });

        test("should work correctly when already on final step", async () => {
            const { trackEvent } = await import(
                "@frak-labs/wallet-shared/common/analytics"
            );

            const steps = [
                {
                    key: "login" as const,
                    params: {} as any,
                    onResponse: vi.fn(),
                },
                {
                    key: "final" as const,
                    params: { action: { key: "success" } } as any,
                    onResponse: vi.fn(),
                },
            ];
            modalStore.setState({ steps: steps as any, currentStep: 1 });

            modalStore.getState().dismissModal();

            const state = modalStore.getState();
            expect(state.dismissed).toBe(true);
            expect(state.currentStep).toBe(1);
            expect(trackEvent).toHaveBeenCalledWith("modal_dismissed", {
                last_step: "final",
                completed: false,
                source: "close_btn",
            });
        });
    });

    describe("Selectors", () => {
        describe("selectCurrentStep", () => {
            test("should return current step object", () => {
                const steps = [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                    {
                        key: "final" as const,
                        params: { action: "redirect" } as any,
                        onResponse: vi.fn(),
                    },
                ];
                modalStore.setState({ steps: steps as any, currentStep: 0 });

                const current = selectCurrentStep(modalStore.getState());

                expect(current).toBe(steps[0]);
            });

            test("should return undefined if no steps", () => {
                modalStore.setState({ steps: undefined, currentStep: 0 });

                const current = selectCurrentStep(modalStore.getState());

                expect(current).toBeUndefined();
            });

            test("should return second step when currentStep is 1", () => {
                const steps = [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                    {
                        key: "final" as const,
                        params: { action: "redirect" } as any,
                        onResponse: vi.fn(),
                    },
                ];
                modalStore.setState({ steps: steps as any, currentStep: 1 });

                const current = selectCurrentStep(modalStore.getState());

                expect(current).toBe(steps[1]);
            });
        });

        describe("selectShouldFinish", () => {
            test("should return null if no steps", () => {
                modalStore.setState({ steps: undefined });

                expect(selectShouldFinish(modalStore.getState())).toBeNull();
            });

            test("should return null if dismissed", () => {
                const steps = [
                    { key: "login" as const, params: {}, onResponse: vi.fn() },
                ];
                modalStore.setState({ steps, dismissed: true });

                expect(selectShouldFinish(modalStore.getState())).toBeNull();
            });

            test("should return null if current step exists and is not final with autoSkip", () => {
                const steps = [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                ];
                modalStore.setState({ steps: steps as any, currentStep: 0 });

                expect(selectShouldFinish(modalStore.getState())).toBeNull();
            });

            test("should return results if no current step data (workflow complete)", () => {
                const steps = [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                ];
                const results = { login: { status: "success" } } as any;
                modalStore.setState({
                    steps: steps as any,
                    currentStep: 1,
                    results,
                });

                expect(selectShouldFinish(modalStore.getState())).toBe(results);
            });

            test("should return results if current step is final with autoSkip", () => {
                const steps = [
                    {
                        key: "final" as const,
                        params: { action: "redirect", autoSkip: true } as any,
                        onResponse: vi.fn(),
                    },
                ];
                const results = {} as any;
                modalStore.setState({
                    steps: steps as any,
                    currentStep: 0,
                    results,
                });

                expect(selectShouldFinish(modalStore.getState())).toBe(results);
            });

            test("should return null if current step is final without autoSkip", () => {
                const steps = [
                    {
                        key: "final" as const,
                        params: { action: "redirect", autoSkip: false } as any,
                        onResponse: vi.fn(),
                    },
                ];
                modalStore.setState({ steps: steps as any, currentStep: 0 });

                expect(selectShouldFinish(modalStore.getState())).toBeNull();
            });

            test("should return null if current step is final with autoSkip undefined", () => {
                const steps = [
                    {
                        key: "final" as const,
                        params: { action: "redirect" } as any,
                        onResponse: vi.fn(),
                    },
                ];
                modalStore.setState({ steps: steps as any, currentStep: 0 });

                expect(selectShouldFinish(modalStore.getState())).toBeNull();
            });
        });

        describe("selectIsDismissed", () => {
            test("should return true when dismissed", () => {
                modalStore.setState({ dismissed: true });

                expect(selectIsDismissed(modalStore.getState())).toBe(true);
            });

            test("should return false when not dismissed", () => {
                modalStore.setState({ dismissed: false });

                expect(selectIsDismissed(modalStore.getState())).toBe(false);
            });
        });

        describe("selectCurrentStepIndex", () => {
            test("should return current step index", () => {
                modalStore.setState({ currentStep: 5 });

                expect(selectCurrentStepIndex(modalStore.getState())).toBe(5);
            });
        });

        test("selectCurrentStep returns undefined when currentStep is out of bounds", () => {
            const steps = [
                {
                    key: "login" as const,
                    params: {} as any,
                    onResponse: vi.fn(),
                },
            ];
            modalStore.setState({ steps: steps as any, currentStep: 5 });

            expect(selectCurrentStep(modalStore.getState())).toBeUndefined();
        });
    });

    describe("Edge cases and complex workflows", () => {
        test("should handle multi-step workflow with onResponse callbacks", () => {
            const steps = [
                { key: "login" as const, params: {} as any },
                { key: "siweAuthenticate" as const, params: {} as any },
                {
                    key: "final" as const,
                    params: { action: "redirect" } as any,
                },
            ];

            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult: {} as any,
                steps,
            });

            // Complete step 1
            let state = modalStore.getState();
            state.steps?.[0].onResponse({ status: "success" } as any);

            state = modalStore.getState();
            expect(state.currentStep).toBe(1);
            expect(state.results).toEqual({ login: { status: "success" } });

            // Complete step 2
            state.steps?.[1].onResponse({ signature: "0x123" } as any);

            state = modalStore.getState();
            expect(state.currentStep).toBe(2);
            expect(state.results).toEqual({
                login: { status: "success" },
                siweAuthenticate: { signature: "0x123" },
            });
        });

        test("should handle rapid modal changes", () => {
            // Set first modal
            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult: {} as any,
                steps: [{ key: "login" as const, params: {} as any }],
            });

            // Immediately set second modal
            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult: { existing: "data" } as any,
                steps: [
                    { key: "siweAuthenticate" as const, params: {} as any },
                ],
            });

            const state = modalStore.getState();
            expect(state.steps).toHaveLength(1);
            expect(state.steps?.[0].key).toBe("siweAuthenticate");
            expect(state.results).toEqual({ existing: "data" });
        });
    });
});
