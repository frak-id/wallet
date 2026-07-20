/** @jsxImportSource react */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveInitialRegisterStep, useRegisterFlow } from "./useRegisterFlow";

// Stub the analytics flow so the mount effect doesn't touch real analytics.
// `endSpy` is shared across the mock so the abandon test can assert the
// payload passed to `flow.end` on unmount. The `end` wrapper flips `ended`
// like the real Flow, so the `if (!flow.ended)` guard is exercised and a
// double-fired cleanup can't silently end the flow twice.
const { endSpy, startFlow } = vi.hoisted(() => {
    const endSpy = vi.fn();
    return {
        endSpy,
        startFlow: vi.fn(() => {
            const flow = {
                ended: false,
                track: vi.fn(),
                end: vi.fn((reason: string, data?: unknown) => {
                    flow.ended = true;
                    endSpy(reason, data);
                }),
            };
            return flow;
        }),
    };
});

vi.mock("@frak-labs/wallet-shared", () => ({ startFlow }));

beforeEach(() => {
    vi.clearAllMocks();
});

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

    test("reports the current step (not the initial one) as last_step on abandon", () => {
        const { result, unmount } = renderHook(() => useRegisterFlow({}));

        act(() => result.current.goToStep("referralCode"));
        expect(result.current.step).toBe("referralCode");

        // Unmounting mid-flow fires the abandon cleanup.
        unmount();

        expect(endSpy).toHaveBeenCalledTimes(1);
        expect(endSpy).toHaveBeenCalledWith("abandoned", {
            last_step: "referralCode",
        });
    });
});
