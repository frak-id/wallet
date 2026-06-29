import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getState: vi.fn(),
    ensureFreshSdkSession: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", () => ({
    sessionStore: { getState: mocks.getState },
}));

vi.mock("@frak-labs/wallet-shared/common/auth/ensureFreshSdkSession", () => ({
    ensureFreshSdkSession: mocks.ensureFreshSdkSession,
}));

// Pull the export after the mocks are registered.
const { filterStepsToDo } = await import("./useDisplayModalListener.impl");

const loginStep = [{ key: "login" as const, params: {} }];

describe("filterStepsToDo", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not skip login when there is no session", async () => {
        mocks.getState.mockReturnValue({ session: null });

        const { currentStep, currentResult } = await filterStepsToDo({
            stepsPrepared: loginStep,
        });

        expect(currentStep).toBe(0);
        expect(currentResult).toEqual({});
        expect(mocks.ensureFreshSdkSession).not.toHaveBeenCalled();
    });

    it("skips login for a server-confirmed live session (fresh)", async () => {
        mocks.getState.mockReturnValue({ session: { address: "0xabc" } });
        mocks.ensureFreshSdkSession.mockResolvedValue({
            status: "fresh",
            sdk: { token: "t" },
        });

        const { currentStep, currentResult } = await filterStepsToDo({
            stepsPrepared: loginStep,
        });

        expect(currentStep).toBe(1);
        expect(currentResult).toEqual({ login: { wallet: "0xabc" } });
    });

    it("still skips login on a transient (stale) failure — never block on a blip", async () => {
        mocks.getState.mockReturnValue({ session: { address: "0xabc" } });
        mocks.ensureFreshSdkSession.mockResolvedValue({
            status: "stale",
            sdk: null,
        });

        const { currentStep } = await filterStepsToDo({
            stepsPrepared: loginStep,
        });

        expect(currentStep).toBe(1);
    });

    it("re-shows login on a server-confirmed dead token", async () => {
        mocks.getState.mockReturnValue({ session: { address: "0xabc" } });
        mocks.ensureFreshSdkSession.mockResolvedValue({ status: "dead" });

        const { currentStep, currentResult } = await filterStepsToDo({
            stepsPrepared: loginStep,
        });

        expect(currentStep).toBe(0);
        expect(currentResult).toEqual({});
    });
});
