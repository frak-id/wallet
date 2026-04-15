import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AssetLogRepository } from "../../rewards/repositories/AssetLogRepository";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type { CalculatedReward, RuleContext } from "../types";
import type { RewardCalculator } from "./RewardCalculator";
import type { RuleConditionEvaluator } from "./RuleConditionEvaluator";
import { buildTimeContext, RuleEngineService } from "./RuleEngineService";

vi.mock("@backend-infrastructure", () => ({
    log: {
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe("RuleEngineService", () => {
    beforeAll(() => {
        // Setup any global mocks if needed
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    const createMockRepository = (): CampaignRuleRepository =>
        ({
            findActiveByMerchant: vi.fn(),
            consumeBudget: vi.fn(),
        }) as unknown as CampaignRuleRepository;

    const createMockConditionEvaluator = (): RuleConditionEvaluator =>
        ({
            evaluate: vi.fn(),
        }) as unknown as RuleConditionEvaluator;

    const createMockRewardCalculator = (): RewardCalculator =>
        ({
            calculateAll: vi.fn(),
        }) as unknown as RewardCalculator;

    const createMockAssetLogRepository = (): AssetLogRepository =>
        ({
            countByCampaignAndUserAsReferee: vi.fn(),
            countByMerchantAndUserAsReferee: vi.fn(),
        }) as unknown as AssetLogRepository;

    const createMockCampaign = (
        overrides?: Partial<CampaignRuleSelect>
    ): CampaignRuleSelect => ({
        id: "campaign-1",
        merchantId: "merchant-1",
        name: "Test Campaign",
        status: "active",
        priority: 0,
        rule: {
            trigger: "purchase",
            conditions: [],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "fixed",
                    amount: 100,
                },
            ],
            maxRewardsPerUser: 1,
        },
        metadata: null,
        budgetConfig: null,
        budgetUsed: {},
        expiresAt: null,
        publishedAt: new Date(),
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });

    const createMockContext = (
        overrides?: Partial<RuleContext>
    ): Omit<RuleContext, "time"> => ({
        user: {
            identityGroupId: "test-user-group",
            walletAddress: null,
        },
        ...overrides,
    });

    const createMockCalculatedReward = (
        overrides?: Partial<CalculatedReward>
    ): CalculatedReward => ({
        recipient: "referee",
        recipientIdentityGroupId: "test-user-group",
        recipientWallet: null,
        type: "token",
        amount: 100,
        token: null,
        campaignRuleId: "campaign-1",
        ...overrides,
    });

    describe("evaluateRules", () => {
        it("should return empty rewards when user cap is reached", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                    maxRewardsPerUser: 1,
                },
            });

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            vi.mocked(
                mockAssetLogRepository.countByCampaignAndUserAsReferee
            ).mockResolvedValue(1);

            const service = new RuleEngineService(
                mockRepository,
                mockConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            expect(result.rewards).toEqual([]);
            expect(result.budgetExceeded).toBe(false);
            expect(result.errors).toEqual([]);
            expect(mockRewardCalculator.calculateAll).not.toHaveBeenCalled();
        });

        it("should proceed to calculate rewards when user is under cap", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                    maxRewardsPerUser: 5,
                },
            });

            const calculatedReward = createMockCalculatedReward();

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            vi.mocked(
                mockAssetLogRepository.countByCampaignAndUserAsReferee
            ).mockResolvedValue(2);
            vi.mocked(mockRewardCalculator.calculateAll).mockReturnValue({
                calculated: [calculatedReward],
                errors: [],
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                mockConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            expect(result.rewards).toEqual([calculatedReward]);
            expect(result.budgetExceeded).toBe(false);
            expect(mockRewardCalculator.calculateAll).toHaveBeenCalled();
        });

        it("should have no cap when maxRewardsPerUser is not set", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                    // maxRewardsPerUser is undefined — no per-campaign cap
                },
            });

            const calculatedReward = createMockCalculatedReward();

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            vi.mocked(mockRewardCalculator.calculateAll).mockReturnValue({
                calculated: [calculatedReward],
                errors: [],
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                mockConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            // Should proceed to calculate rewards — no per-campaign cap
            expect(result.rewards).toEqual([calculatedReward]);
            expect(
                mockAssetLogRepository.countByCampaignAndUserAsReferee
            ).not.toHaveBeenCalled();
        });

        it("should respect custom cap value of 5", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                    maxRewardsPerUser: 5,
                },
            });

            const calculatedReward = createMockCalculatedReward();

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            // User has 4 rewards, cap is 5, so should proceed
            vi.mocked(
                mockAssetLogRepository.countByCampaignAndUserAsReferee
            ).mockResolvedValue(4);
            vi.mocked(mockRewardCalculator.calculateAll).mockReturnValue({
                calculated: [calculatedReward],
                errors: [],
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                mockConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            expect(result.rewards).toEqual([calculatedReward]);
            expect(mockRewardCalculator.calculateAll).toHaveBeenCalled();
        });

        it("should return empty rewards when custom cap is reached at exactly 5", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                    maxRewardsPerUser: 5,
                },
            });

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            // User has 5 rewards, cap is 5, so should not proceed
            vi.mocked(
                mockAssetLogRepository.countByCampaignAndUserAsReferee
            ).mockResolvedValue(5);

            const service = new RuleEngineService(
                mockRepository,
                mockConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            expect(result.rewards).toEqual([]);
            expect(result.budgetExceeded).toBe(false);
            expect(mockRewardCalculator.calculateAll).not.toHaveBeenCalled();
        });

        it("should return empty rewards when merchant-wide cap is reached", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                    merchantMaxRewardsPerUser: 2,
                },
            });

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            // User has 2 rewards across all merchant campaigns
            vi.mocked(
                mockAssetLogRepository.countByMerchantAndUserAsReferee
            ).mockResolvedValue(2);

            const service = new RuleEngineService(
                mockRepository,
                mockConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            expect(result.rewards).toEqual([]);
            expect(result.budgetExceeded).toBe(false);
            expect(mockRewardCalculator.calculateAll).not.toHaveBeenCalled();
        });

        it("should proceed when merchant-wide count is under cap", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                    merchantMaxRewardsPerUser: 3,
                },
            });

            const calculatedReward = createMockCalculatedReward();

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            vi.mocked(
                mockAssetLogRepository.countByMerchantAndUserAsReferee
            ).mockResolvedValue(1);
            vi.mocked(mockRewardCalculator.calculateAll).mockReturnValue({
                calculated: [calculatedReward],
                errors: [],
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                mockConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            expect(result.rewards).toEqual([calculatedReward]);
            expect(mockRewardCalculator.calculateAll).toHaveBeenCalled();
        });

        it("should skip merchant-wide count query when no campaign uses it", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                    maxRewardsPerUser: 5,
                    // merchantMaxRewardsPerUser not set
                },
            });

            const calculatedReward = createMockCalculatedReward();

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            vi.mocked(
                mockAssetLogRepository.countByCampaignAndUserAsReferee
            ).mockResolvedValue(0);
            vi.mocked(mockRewardCalculator.calculateAll).mockReturnValue({
                calculated: [calculatedReward],
                errors: [],
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                mockConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            // Should never query merchant-wide count
            expect(
                mockAssetLogRepository.countByMerchantAndUserAsReferee
            ).not.toHaveBeenCalled();
        });
    });

    describe("buildTimeContext", () => {
        it("should build time context with correct structure", () => {
            const testDate = new Date("2025-02-25T14:30:45Z");
            const context = buildTimeContext(testDate);

            expect(context).toHaveProperty("dayOfWeek");
            expect(context).toHaveProperty("hourOfDay");
            expect(context).toHaveProperty("date");
            expect(context).toHaveProperty("timestamp");
            expect(context.hourOfDay).toBe(14);
            expect(context.date).toBe("2025-02-25");
        });

        it("should use current date when no date provided", () => {
            const context = buildTimeContext();

            expect(context).toHaveProperty("dayOfWeek");
            expect(context).toHaveProperty("hourOfDay");
            expect(context).toHaveProperty("date");
            expect(context).toHaveProperty("timestamp");
            expect(typeof context.timestamp).toBe("number");
        });
    });
});
