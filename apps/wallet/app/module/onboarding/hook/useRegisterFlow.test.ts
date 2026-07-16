/** @jsxImportSource react */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { resolveInitialRegisterStep, useRegisterFlow } from "./useRegisterFlow";

// Stub the analytics flow so the mount effect doesn't touch real analytics.
vi.mock("@frak-labs/wallet-shared", () => ({
    startFlow: () => ({ ended: false, track: vi.fn(), end: vi.fn() }),
}));

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
});
