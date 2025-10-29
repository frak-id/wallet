import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    modalStore,
    selectActiveStep,
    selectCurrentStep,
    selectCurrentStepIndex,
    selectCurrentStepObject,
    selectDisplayedSteps,
    selectIsDismissed,
    selectResults,
    selectShouldFinish,
    selectSteps,
} from "./modalStore";

// Mock wallet-shared imports
vi.mock("@frak-labs/wallet-shared", () => ({
    trackGenericEvent: vi.fn(),
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
        it("should have correct initial state", () => {
            const state = modalStore.getState();
            expect(state.steps).toBeUndefined();
            expect(state.currentStep).toBe(0);
            expect(state.results).toBeUndefined();
            expect(state.dismissed).toBe(false);
        });
    });

    describe("setNewModal", () => {
        it("should set new modal with steps and initial results", () => {
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

        it("should add onResponse callbacks to each step", () => {
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

        it("should allow setting non-zero initial step", () => {
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

        it("should reset dismissed flag when setting new modal", () => {
            modalStore.setState({ dismissed: true });

            modalStore.getState().setNewModal({
                currentStep: 0,
                initialResult: {} as any,
                steps: [{ key: "login" as const, params: {} as any }],
            });

            expect(modalStore.getState().dismissed).toBe(false);
        });

        it("should call onResponse to update results and move to next step", async () => {
            const { trackGenericEvent } = await import(
                "@frak-labs/wallet-shared"
            );

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
            expect(trackGenericEvent).toHaveBeenCalledWith(
                "modal_step_login_completed"
            );
        });

        it("should not update results if results is undefined when onResponse called", () => {
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

    describe("completeStep", () => {
        beforeEach(() => {
            modalStore.setState({
                steps: [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                ],
                currentStep: 0,
                results: {} as any,
                dismissed: false,
            });
        });

        it("should update results with step response", () => {
            modalStore
                .getState()
                .completeStep("login", { status: "success" } as any);

            const state = modalStore.getState();
            expect(state.results).toEqual({ login: { status: "success" } });
        });

        it("should track analytics event", async () => {
            const { trackGenericEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            modalStore
                .getState()
                .completeStep("login", { status: "success" } as any);

            expect(trackGenericEvent).toHaveBeenCalledWith(
                "modal_step_login_completed"
            );
        });

        it("should move to next step", () => {
            modalStore
                .getState()
                .completeStep("login", { status: "success" } as any);

            expect(modalStore.getState().currentStep).toBe(1);
        });

        it("should return early if results is undefined", () => {
            modalStore.setState({ results: undefined });

            modalStore
                .getState()
                .completeStep("login", { status: "success" } as any);

            expect(modalStore.getState().currentStep).toBe(0);
        });

        it("should return early if steps is undefined", () => {
            modalStore.setState({ steps: undefined });

            modalStore
                .getState()
                .completeStep("login", { status: "success" } as any);

            expect(modalStore.getState().currentStep).toBe(0);
        });
    });

    describe("nextStep", () => {
        it("should increment currentStep by 1", () => {
            modalStore.setState({ currentStep: 0 });

            modalStore.getState().nextStep();

            expect(modalStore.getState().currentStep).toBe(1);
        });

        it("should increment from non-zero step", () => {
            modalStore.setState({ currentStep: 3 });

            modalStore.getState().nextStep();

            expect(modalStore.getState().currentStep).toBe(4);
        });
    });

    describe("clearModal", () => {
        it("should reset all modal state", () => {
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

    describe("setDismissed", () => {
        it("should set dismissed to true", () => {
            modalStore.getState().setDismissed(true);

            expect(modalStore.getState().dismissed).toBe(true);
        });

        it("should set dismissed to false", () => {
            modalStore.setState({ dismissed: true });

            modalStore.getState().setDismissed(false);

            expect(modalStore.getState().dismissed).toBe(false);
        });
    });

    describe("dismissModal", () => {
        it("should set dismissed flag when no steps present", async () => {
            const { trackGenericEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            modalStore.setState({ steps: undefined });

            modalStore.getState().dismissModal();

            const state = modalStore.getState();
            expect(state.dismissed).toBe(true);
            expect(trackGenericEvent).toHaveBeenCalledWith("modal_dismissed");
        });

        it("should set dismissed flag when no final step found", async () => {
            const { trackGenericEvent } = await import(
                "@frak-labs/wallet-shared"
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
            expect(trackGenericEvent).toHaveBeenCalledWith("modal_dismissed");
        });

        it("should atomically set dismissed and move to final step for non-reward", async () => {
            const { trackGenericEvent } = await import(
                "@frak-labs/wallet-shared"
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
            expect(trackGenericEvent).toHaveBeenCalledWith("modal_dismissed");
        });

        it("should atomically set dismissed and skip past reward final step", async () => {
            const { trackGenericEvent } = await import(
                "@frak-labs/wallet-shared"
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
            expect(trackGenericEvent).toHaveBeenCalledWith("modal_dismissed");
        });

        it("should work correctly when already on final step", async () => {
            const { trackGenericEvent } = await import(
                "@frak-labs/wallet-shared"
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
            expect(trackGenericEvent).toHaveBeenCalledWith("modal_dismissed");
        });
    });

    describe("Selectors", () => {
        describe("selectCurrentStep", () => {
            it("should return current step object", () => {
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

            it("should return undefined if no steps", () => {
                modalStore.setState({ steps: undefined, currentStep: 0 });

                const current = selectCurrentStep(modalStore.getState());

                expect(current).toBeUndefined();
            });

            it("should return second step when currentStep is 1", () => {
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

        describe("selectActiveStep", () => {
            it("should return current step index", () => {
                modalStore.setState({ currentStep: 3 });

                expect(selectActiveStep(modalStore.getState())).toBe(3);
            });
        });

        describe("selectResults", () => {
            it("should return results object", () => {
                const results = { login: { status: "success" } } as any;
                modalStore.setState({ results });

                expect(selectResults(modalStore.getState())).toBe(results);
            });

            it("should return undefined if no results", () => {
                modalStore.setState({ results: undefined });

                expect(selectResults(modalStore.getState())).toBeUndefined();
            });
        });

        describe("selectSteps", () => {
            it("should return steps array", () => {
                const steps = [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                ];
                modalStore.setState({ steps: steps as any });

                expect(selectSteps(modalStore.getState())).toBe(steps);
            });

            it("should return undefined if no steps", () => {
                modalStore.setState({ steps: undefined });

                expect(selectSteps(modalStore.getState())).toBeUndefined();
            });
        });

        describe("selectShouldFinish", () => {
            it("should return null if no steps", () => {
                modalStore.setState({ steps: undefined });

                expect(selectShouldFinish(modalStore.getState())).toBeNull();
            });

            it("should return null if dismissed", () => {
                const steps = [
                    { key: "login" as const, params: {}, onResponse: vi.fn() },
                ];
                modalStore.setState({ steps, dismissed: true });

                expect(selectShouldFinish(modalStore.getState())).toBeNull();
            });

            it("should return null if current step exists and is not final with autoSkip", () => {
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

            it("should return results if no current step data (workflow complete)", () => {
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

            it("should return results if current step is final with autoSkip", () => {
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

            it("should return null if current step is final without autoSkip", () => {
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

            it("should return null if current step is final with autoSkip undefined", () => {
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
            it("should return true when dismissed", () => {
                modalStore.setState({ dismissed: true });

                expect(selectIsDismissed(modalStore.getState())).toBe(true);
            });

            it("should return false when not dismissed", () => {
                modalStore.setState({ dismissed: false });

                expect(selectIsDismissed(modalStore.getState())).toBe(false);
            });
        });

        describe("selectDisplayedSteps", () => {
            it("should return steps with metadata", () => {
                const steps = [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                ];
                modalStore.setState({
                    steps: steps as any,
                    currentStep: 1,
                    dismissed: false,
                });

                const displayed = selectDisplayedSteps(modalStore.getState());

                expect(displayed).toEqual({
                    steps,
                    currentStep: 1,
                    dismissed: false,
                });
            });

            it("should return undefined if no steps", () => {
                modalStore.setState({ steps: undefined });

                expect(
                    selectDisplayedSteps(modalStore.getState())
                ).toBeUndefined();
            });
        });

        describe("selectCurrentStepIndex", () => {
            it("should return current step index", () => {
                modalStore.setState({ currentStep: 5 });

                expect(selectCurrentStepIndex(modalStore.getState())).toBe(5);
            });
        });

        describe("selectCurrentStepObject", () => {
            it("should return current step object", () => {
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

                const current = selectCurrentStepObject(modalStore.getState());

                expect(current).toBe(steps[1]);
            });

            it("should return undefined if no steps", () => {
                modalStore.setState({ steps: undefined, currentStep: 0 });

                const current = selectCurrentStepObject(modalStore.getState());

                expect(current).toBeUndefined();
            });

            it("should return undefined if currentStep is out of bounds", () => {
                const steps = [
                    {
                        key: "login" as const,
                        params: {} as any,
                        onResponse: vi.fn(),
                    },
                ];
                modalStore.setState({ steps: steps as any, currentStep: 5 });

                const current = selectCurrentStepObject(modalStore.getState());

                expect(current).toBeUndefined();
            });
        });
    });

    describe("Edge cases and complex workflows", () => {
        it("should handle multi-step workflow with onResponse callbacks", async () => {
            const { trackGenericEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            const steps = [
                { key: "login" as const, params: {} as any },
                { key: "openSession" as const, params: {} as any },
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
            state.steps?.[1].onResponse({ session: "abc123" } as any);

            state = modalStore.getState();
            expect(state.currentStep).toBe(2);
            expect(state.results).toEqual({
                login: { status: "success" },
                openSession: { session: "abc123" },
            });

            expect(trackGenericEvent).toHaveBeenCalledTimes(2);
        });

        it("should handle rapid modal changes", () => {
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
                steps: [{ key: "openSession" as const, params: {} as any }],
            });

            const state = modalStore.getState();
            expect(state.steps).toHaveLength(1);
            expect(state.steps?.[0].key).toBe("openSession");
            expect(state.results).toEqual({ existing: "data" });
        });
    });
});
