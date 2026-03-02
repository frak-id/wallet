import { describe, expect, it } from "vitest";
import type { OnboardingStepData } from "./onboarding";
import {
    getOnboardingStatusMessage,
    stepValidations,
    validateCompleteOnboarding,
    validateStep,
} from "./onboarding";

describe("stepValidations", () => {
    it("step 1: passes when shopInfo is present", () => {
        const data: OnboardingStepData = { merchantId: "test-merchant-id" };
        expect(stepValidations[1](data)).toBe(true);
    });

    it("step 1: fails when shopInfo is absent", () => {
        expect(stepValidations[1]({})).toBe(false);
    });

    it("step 2: passes when webPixel has id", () => {
        const data: OnboardingStepData = {
            webPixel: { id: "pixel-123", settings: "{}" },
        };
        expect(stepValidations[2](data)).toBe(true);
    });

    it("step 2: fails when webPixel is undefined", () => {
        expect(stepValidations[2]({})).toBe(false);
    });

    it("step 3: passes when webhooks have entries", () => {
        const data: OnboardingStepData = {
            webhooks: [
                {
                    node: {
                        id: "1",
                        topic: "ORDERS_UPDATED",
                        filter: "",
                        format: "JSON",
                        endpoint: { __typename: "WebhookHttpEndpoint" },
                    },
                },
            ],
        };
        expect(stepValidations[3](data)).toBe(true);
    });

    it("step 3: fails when webhooks is empty", () => {
        const data: OnboardingStepData = { webhooks: [] };
        expect(stepValidations[3](data)).toBe(false);
    });

    it("step 4: passes when frakWebhook.setup is true", () => {
        const data: OnboardingStepData = {
            frakWebhook: { setup: true },
        };
        expect(stepValidations[4](data)).toBe(true);
    });

    it("step 4: fails when frakWebhook.setup is false", () => {
        const data: OnboardingStepData = {
            frakWebhook: { setup: false },
        };
        expect(stepValidations[4](data)).toBe(false);
    });

    it("step 5: passes when isThemeHasFrakActivated is true", () => {
        const data: OnboardingStepData = { isThemeHasFrakActivated: true };
        expect(stepValidations[5](data)).toBe(true);
    });

    it("step 5: fails when isThemeHasFrakActivated is false", () => {
        const data: OnboardingStepData = { isThemeHasFrakActivated: false };
        expect(stepValidations[5](data)).toBe(false);
    });

    it("step 6: passes when isThemeHasFrakButton is true", () => {
        const data: OnboardingStepData = { isThemeHasFrakButton: true };
        expect(stepValidations[6](data)).toBe(true);
    });

    it("step 6: passes when themeWalletButton is present", () => {
        const data: OnboardingStepData = {
            isThemeHasFrakButton: false,
            themeWalletButton: "block-id",
        };
        expect(stepValidations[6](data)).toBe(true);
    });

    it("step 6: fails when neither button is present", () => {
        const data: OnboardingStepData = {
            isThemeHasFrakButton: false,
            themeWalletButton: null,
        };
        expect(stepValidations[6](data)).toBe(false);
    });
});

describe("validateStep", () => {
    it("returns false (not disabled) when step passes", () => {
        const data: OnboardingStepData = {
            webPixel: { id: "px-1", settings: "{}" },
        };
        // validateStep returns true when step is *invalid* (button disabled)
        expect(validateStep(2, data)).toBe(false);
    });

    it("returns true (disabled) when step fails", () => {
        expect(validateStep(2, {})).toBe(true);
    });

    it("returns false for unknown step number", () => {
        expect(validateStep(99, {})).toBe(false);
    });
});

describe("validateCompleteOnboarding", () => {
    const completeData: OnboardingStepData = {
        merchantId: "test-merchant-id",
        webPixel: { id: "px", settings: "{}" },
        webhooks: [
            {
                node: {
                    id: "1",
                    topic: "ORDERS_UPDATED",
                    filter: "",
                    format: "JSON",
                    endpoint: { __typename: "WebhookHttpEndpoint" },
                },
            },
        ],
        frakWebhook: { setup: true },
        isThemeHasFrakActivated: true,
        isThemeHasFrakButton: true,
    };

    it("reports complete when all steps pass", () => {
        const result = validateCompleteOnboarding(completeData);
        expect(result.isComplete).toBe(true);
        expect(result.failedSteps).toEqual([]);
        expect(result.completedSteps).toEqual([1, 2, 3, 4, 5, 6]);
        expect(result.hasMissedCriticalSteps).toBe(false);
    });

    it("reports failed steps correctly", () => {
        const result = validateCompleteOnboarding({});
        expect(result.isComplete).toBe(false);
        expect(result.failedSteps).toEqual([1, 2, 3, 4, 5, 6]);
        expect(result.completedSteps).toEqual([]);
    });

    it("detects missed critical steps (steps 1-5)", () => {
        // Only step 6 passes — all critical steps (1-5) fail
        const data: OnboardingStepData = { isThemeHasFrakButton: true };
        const result = validateCompleteOnboarding(data);
        expect(result.hasMissedCriticalSteps).toBe(true);
    });

    it("non-critical step 6 failure does not flag hasMissedCriticalSteps", () => {
        const { isThemeHasFrakButton: _, ...withoutButton } = completeData;
        const result = validateCompleteOnboarding(withoutButton);
        expect(result.hasMissedCriticalSteps).toBe(false);
        expect(result.failedSteps).toContain(6);
    });
});

describe("getOnboardingStatusMessage", () => {
    it("returns null when onboarding is complete", () => {
        const result = getOnboardingStatusMessage({
            isComplete: true,
            failedSteps: [],
            completedSteps: [1, 2, 3, 4, 5, 6],
        });
        expect(result).toBeNull();
    });

    it("lists missing step names", () => {
        const result = getOnboardingStatusMessage({
            isComplete: false,
            failedSteps: [2, 5],
            completedSteps: [1, 3, 4, 6],
        });
        expect(result).toBe(
            "Onboarding incomplete. Missing: Web Pixel, Theme Activation"
        );
    });

    it("handles all steps missing", () => {
        const result = getOnboardingStatusMessage({
            isComplete: false,
            failedSteps: [1, 2, 3, 4, 5, 6],
            completedSteps: [],
        });
        expect(result).toContain("Shop Info");
        expect(result).toContain("Frak Buttons");
    });
});
