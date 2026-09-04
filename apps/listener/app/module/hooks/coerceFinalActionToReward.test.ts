import type { ModalRpcStepsInput } from "@frak-labs/core-sdk";
import { describe, expect, it, vi } from "vitest";

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", () => ({
    sessionStore: { getState: vi.fn() },
}));

vi.mock("@frak-labs/wallet-shared/common/auth/ensureFreshSdkSession", () => ({
    ensureFreshSdkSession: vi.fn(),
}));

// Dynamic: the module reaches the session store at import time, so the mocks
// above must register first. Matches `filterStepsToDo.test.ts` on the same module.
const { coerceFinalActionToReward } = await import(
    "./useDisplayModalListener.impl"
);

// A partner bundle cached before the `sharing` action was retired still sends
// it, so the shape is no longer expressible in `ModalRpcStepsInput`.
const legacySharingSteps = {
    login: {},
    final: {
        action: {
            key: "sharing",
            options: { popupTitle: "Share!", text: "Check this out" },
        },
    },
} as unknown as ModalRpcStepsInput;

describe("coerceFinalActionToReward", () => {
    it("coerces a retired sharing action to the reward screen", () => {
        const result = coerceFinalActionToReward(legacySharingSteps);

        expect(result.final?.action).toEqual({ key: "reward" });
    });

    it("drops the retired action's options rather than carrying them forward", () => {
        const result = coerceFinalActionToReward(legacySharingSteps);

        expect(result.final?.action).not.toHaveProperty("options");
    });

    it("coerces an unrecognised action key, not only the retired one", () => {
        const steps = {
            final: { action: { key: "referred" } },
        } as unknown as ModalRpcStepsInput;

        expect(coerceFinalActionToReward(steps).final?.action).toEqual({
            key: "reward",
        });
    });

    it("preserves the other final-step params while coercing the action", () => {
        const steps = {
            final: {
                autoSkip: true,
                dismissedMetadata: { title: "Dismiss" },
                action: { key: "sharing" },
            },
        } as unknown as ModalRpcStepsInput;

        const result = coerceFinalActionToReward(steps);

        expect(result.final).toEqual({
            autoSkip: true,
            dismissedMetadata: { title: "Dismiss" },
            action: { key: "reward" },
        });
    });

    it("returns a reward step unchanged, by reference", () => {
        const steps: ModalRpcStepsInput = {
            login: {},
            final: { action: { key: "reward" } },
        };

        expect(coerceFinalActionToReward(steps)).toBe(steps);
    });

    it("returns steps without a final step unchanged, by reference", () => {
        const steps: ModalRpcStepsInput = { login: {} };

        expect(coerceFinalActionToReward(steps)).toBe(steps);
    });

    it("leaves the other steps untouched", () => {
        const result = coerceFinalActionToReward(legacySharingSteps);

        expect(result.login).toEqual({});
    });
});
