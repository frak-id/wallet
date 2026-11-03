/** @jsxImportSource react */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mirrors the real Flow's end/reopen guards. Ends are recorded per flow: listeners from earlier tests' module instances stay on `document`.
const { emitted, startFlow } = vi.hoisted(() => {
    const emitted: unknown[][] = [];
    return {
        emitted,
        startFlow: vi.fn(() => {
            const ends: unknown[] = [];
            emitted.push(ends);
            let outcome: string | undefined;
            return {
                get ended() {
                    return outcome !== undefined;
                },
                track: vi.fn(),
                end: vi.fn((reason: string, data?: unknown) => {
                    if (outcome) return;
                    outcome = reason;
                    ends.push([reason, data]);
                }),
                reopen: vi.fn(() => {
                    if (outcome === "abandoned") outcome = undefined;
                }),
            };
        }),
    };
});

vi.mock("@frak-labs/wallet-shared", () => ({ startFlow }));

let resolveInitialRegisterStep: typeof import("./useRegisterFlow").resolveInitialRegisterStep;
let useRegisterFlow: typeof import("./useRegisterFlow").useRegisterFlow;

beforeEach(async () => {
    vi.clearAllMocks();
    setVisibility("visible");
    emitted.length = 0;
    vi.resetModules();
    ({ resolveInitialRegisterStep, useRegisterFlow } = await import(
        "./useRegisterFlow"
    ));
});

function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, "visibilityState", {
        value: state,
        configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("resolveInitialRegisterStep", () => {
    test("starts at the first slide with no prefilled email", () => {
        expect(resolveInitialRegisterStep()).toBe("onboardingOne");
        expect(resolveInitialRegisterStep(undefined)).toBe("onboardingOne");
    });

    test("jumps to the secure-space step when an email is prefilled", () => {
        expect(resolveInitialRegisterStep("a@b.co")).toBe("onboardingThree");
    });
});

describe("useRegisterFlow", () => {
    test("resolves the initial step from the prefilled email", () => {
        const { result } = renderHook(() =>
            useRegisterFlow({ prefilledEmail: "a@b.co" })
        );
        expect(result.current.step).toBe("onboardingThree");
    });

    test("goToStep advances the current step and runs onBeforeTransition", () => {
        const onBeforeTransition = vi.fn();
        const { result } = renderHook(() =>
            useRegisterFlow({ onBeforeTransition })
        );

        expect(result.current.step).toBe("onboardingOne");

        act(() => result.current.goToStep("emailInput"));
        expect(result.current.step).toBe("emailInput");

        act(() => result.current.goToStep("welcome"));
        expect(result.current.step).toBe("welcome");

        expect(onBeforeTransition).toHaveBeenCalledTimes(2);
    });

    test("a remount continues the same flow without an abandon", () => {
        const first = renderHook(() => useRegisterFlow({}));
        const flow = first.result.current.flowRef.current;
        first.unmount();

        const second = renderHook(() => useRegisterFlow({}));

        expect(startFlow).toHaveBeenCalledTimes(1);
        expect(second.result.current.flowRef.current).toBe(flow);
        expect(emitted).toEqual([[]]);
    });

    test("hiding the page abandons at the current step, showing it again resumes the flow", () => {
        const { result } = renderHook(() => useRegisterFlow({}));
        act(() => result.current.goToStep("emailInput"));

        setVisibility("hidden");
        expect(emitted).toEqual([[["abandoned", { last_step: "emailInput" }]]]);

        setVisibility("visible");
        expect(result.current.flowRef.current?.ended).toBe(false);
        expect(startFlow).toHaveBeenCalledTimes(1);
    });

    test("after leaving /register, the next hide ends the flow once at the last step", () => {
        const { result, unmount } = renderHook(() => useRegisterFlow({}));
        act(() => result.current.goToStep("emailInput"));
        unmount();

        setVisibility("hidden");
        setVisibility("visible");
        setVisibility("hidden");

        expect(emitted).toEqual([[["abandoned", { last_step: "emailInput" }]]]);
    });

    test("coming back to /register resumes a flow abandoned elsewhere", () => {
        const first = renderHook(() => useRegisterFlow({}));
        const flow = first.result.current.flowRef.current;
        first.unmount();
        setVisibility("hidden");
        setVisibility("visible");

        const second = renderHook(() => useRegisterFlow({}));

        expect(startFlow).toHaveBeenCalledTimes(1);
        expect(second.result.current.flowRef.current).toBe(flow);
        expect(flow?.ended).toBe(false);
    });

    test("a remount after success starts a new flow", () => {
        const first = renderHook(() => useRegisterFlow({}));
        first.result.current.flowRef.current?.end("succeeded");
        first.unmount();

        renderHook(() => useRegisterFlow({}));

        expect(startFlow).toHaveBeenCalledTimes(2);
    });

    test("tracks game_step_viewed with its step", () => {
        const { result } = renderHook(() => useRegisterFlow({}));
        act(() => result.current.goToStep("gameReward"));
        act(() => result.current.goToStep("gameRules"));

        expect(result.current.flowRef.current?.track).toHaveBeenCalledWith(
            "game_step_viewed",
            { step: "reward" }
        );
        expect(result.current.flowRef.current?.track).toHaveBeenCalledWith(
            "game_step_viewed",
            { step: "rules" }
        );
    });
});
