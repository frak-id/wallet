import { describe, expect, it, vi } from "vitest";
import type {
    ReferralChainMember,
    RewardDefinition,
    RuleContext,
} from "../types";
import { RewardCalculator } from "./RewardCalculator";
import type { RuleConditionEvaluator } from "./RuleConditionEvaluator";

const conditionEvaluator = {
    evaluate: vi.fn(),
    getFieldValue: vi.fn(),
} as unknown as RuleConditionEvaluator;

const calculator = new RewardCalculator(conditionEvaluator);

const baseContext: RuleContext = {
    user: {
        identityGroupId: "user-1",
        walletAddress: null,
    },
    time: {
        dayOfWeek: 1,
        hourOfDay: 12,
        date: "2025-01-01",
        timestamp: 0,
    },
    attribution: {
        source: "referral_link",
        touchpointId: null,
        referrerIdentityGroupId: "referrer-1",
    },
};

describe("RewardCalculator.calculateAll — lockup propagation", () => {
    it("attaches defaultLockupSeconds to a simple referee reward", () => {
        const rewards: RewardDefinition[] = [
            {
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: 50,
            },
        ];

        const { calculated } = calculator.calculateAll(
            rewards,
            baseContext,
            "campaign-1",
            undefined,
            undefined,
            7 * 86_400
        );

        expect(calculated).toHaveLength(1);
        expect(calculated[0].lockupSeconds).toBe(7 * 86_400);
    });

    it("propagates defaultLockupSeconds to every member of a chained referrer reward", () => {
        const referralChain: ReferralChainMember[] = [
            { identityGroupId: "ref-1", depth: 1 },
            { identityGroupId: "ref-2", depth: 2 },
            { identityGroupId: "ref-3", depth: 3 },
        ];
        const rewards: RewardDefinition[] = [
            {
                recipient: "referrer",
                type: "token",
                amountType: "fixed",
                amount: 100,
                chaining: {
                    deperditionPerLevel: 50,
                    maxDepth: 3,
                },
            },
        ];

        const { calculated } = calculator.calculateAll(
            rewards,
            baseContext,
            "campaign-1",
            referralChain,
            undefined,
            14 * 86_400
        );

        expect(calculated.length).toBeGreaterThan(0);
        for (const r of calculated) {
            expect(r.lockupSeconds).toBe(14 * 86_400);
        }
    });

    it("leaves lockupSeconds undefined when no rule-level default is set", () => {
        const rewards: RewardDefinition[] = [
            {
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: 10,
            },
        ];

        const { calculated } = calculator.calculateAll(
            rewards,
            baseContext,
            "campaign-1"
        );

        expect(calculated).toHaveLength(1);
        expect(calculated[0].lockupSeconds).toBeUndefined();
    });
});
