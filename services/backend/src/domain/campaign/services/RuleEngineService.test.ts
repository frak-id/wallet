import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AssetLogRepository } from "../../rewards/repositories/AssetLogRepository";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type { CalculatedReward, PurchaseContext, RuleContext } from "../types";
import type { RewardCalculator } from "./RewardCalculator";
import { RuleConditionEvaluator } from "./RuleConditionEvaluator";
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
            countByCampaignsAndUserAsReferee: vi
                .fn()
                .mockResolvedValue(new Map()),
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
                mockAssetLogRepository.countByCampaignsAndUserAsReferee
            ).mockResolvedValue(new Map([["campaign-1", 1]]));

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
                mockAssetLogRepository.countByCampaignsAndUserAsReferee
            ).mockResolvedValue(new Map([["campaign-1", 2]]));
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [calculatedReward],
                errors: [],
                deferForUnpriceableReward: false,
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

        it("propagates the defer flag and skips budget when a percentage reward is unpriceable", async () => {
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
                            amountType: "percentage",
                            percent: 5,
                            percentOf: "purchase_amount",
                        },
                    ],
                },
            });

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [],
                errors: [],
                deferForUnpriceableReward: true,
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

            expect(result.deferForUnpriceableReward).toBe(true);
            expect(result.rewards).toEqual([]);
            expect(mockRepository.consumeBudget).not.toHaveBeenCalled();
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
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [calculatedReward],
                errors: [],
                deferForUnpriceableReward: false,
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
                mockAssetLogRepository.countByCampaignsAndUserAsReferee
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
                mockAssetLogRepository.countByCampaignsAndUserAsReferee
            ).mockResolvedValue(new Map([["campaign-1", 4]]));
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [calculatedReward],
                errors: [],
                deferForUnpriceableReward: false,
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
                mockAssetLogRepository.countByCampaignsAndUserAsReferee
            ).mockResolvedValue(new Map([["campaign-1", 5]]));

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
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [calculatedReward],
                errors: [],
                deferForUnpriceableReward: false,
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
                mockAssetLogRepository.countByCampaignsAndUserAsReferee
            ).mockResolvedValue(new Map([["campaign-1", 0]]));
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [calculatedReward],
                errors: [],
                deferForUnpriceableReward: false,
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

        it("keeps the merchant-wide cap live across campaigns in one evaluation", async () => {
            const mockRepository = createMockRepository();
            const mockConditionEvaluator = createMockConditionEvaluator();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const sharedRule = {
                trigger: "purchase" as const,
                conditions: [],
                rewards: [
                    {
                        recipient: "referee" as const,
                        type: "token" as const,
                        amountType: "fixed" as const,
                        amount: 100,
                    },
                ],
                merchantMaxRewardsPerUser: 1,
            };
            const campaignA = createMockCampaign({
                id: "campaign-a",
                rule: sharedRule,
            });
            const campaignB = createMockCampaign({
                id: "campaign-b",
                rule: sharedRule,
            });

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaignA,
                campaignB,
            ]);
            vi.mocked(mockConditionEvaluator.evaluate).mockReturnValue(true);
            vi.mocked(
                mockAssetLogRepository.countByMerchantAndUserAsReferee
            ).mockResolvedValue(0);
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [
                    createMockCalculatedReward({ recipient: "referee" }),
                ],
                errors: [],
                deferForUnpriceableReward: false,
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

            // A fills the cap of 1, so B is skipped; a stale count grants both.
            expect(result.rewards).toHaveLength(1);
            expect(mockRewardCalculator.calculateAll).toHaveBeenCalledTimes(1);
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

    describe("productScope", () => {
        // Real evaluator here (not mocked) so the item-level filter/matched-set
        // logic in evaluateSingleCampaign is exercised end to end.
        const realConditionEvaluator = new RuleConditionEvaluator();

        const purchaseContext = (
            items: PurchaseContext["items"]
        ): Omit<RuleContext, "time"> => ({
            user: { identityGroupId: "test-user-group", walletAddress: null },
            purchase: {
                orderId: "order-1",
                amount: items.reduce((sum, i) => sum + i.totalPrice, 0),
                currency: "usd",
                items,
            },
        });

        const scopedCampaign = (
            productScope: NonNullable<
                CampaignRuleSelect["rule"]["productScope"]
            >
        ): CampaignRuleSelect =>
            createMockCampaign({
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    productScope,
                    rewards: [
                        {
                            recipient: "referee",
                            type: "token",
                            amountType: "fixed",
                            amount: 100,
                        },
                    ],
                },
            });

        it("matches and rewards when a line item satisfies productScope", async () => {
            const mockRepository = createMockRepository();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = scopedCampaign([
                { field: "productId", operator: "eq", value: "A" },
            ]);

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            const calculatedReward = createMockCalculatedReward();
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [calculatedReward],
                errors: [],
                deferForUnpriceableReward: false,
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                realConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: purchaseContext([
                    {
                        productId: "A",
                        name: "Widget",
                        quantity: 1,
                        unitPrice: 10,
                        totalPrice: 10,
                    },
                ]),
            });

            expect(result.rewards).toEqual([calculatedReward]);
            expect(mockRewardCalculator.calculateAll).toHaveBeenCalled();
        });

        it("skips the campaign (no budget consumed) when no line item matches", async () => {
            const mockRepository = createMockRepository();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = scopedCampaign([
                { field: "productId", operator: "eq", value: "A" },
            ]);

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);

            const service = new RuleEngineService(
                mockRepository,
                realConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: purchaseContext([
                    {
                        productId: "B",
                        name: "Gadget",
                        quantity: 1,
                        unitPrice: 10,
                        totalPrice: 10,
                    },
                ]),
            });

            expect(result.rewards).toEqual([]);
            expect(mockRewardCalculator.calculateAll).not.toHaveBeenCalled();
            expect(mockRepository.consumeBudget).not.toHaveBeenCalled();
        });

        it("skips a productScope campaign when there is no purchase context", async () => {
            const mockRepository = createMockRepository();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = scopedCampaign([
                { field: "productId", operator: "eq", value: "A" },
            ]);

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);

            const service = new RuleEngineService(
                mockRepository,
                realConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: createMockContext(),
            });

            expect(result.rewards).toEqual([]);
            expect(mockRewardCalculator.calculateAll).not.toHaveBeenCalled();
        });

        it("additivity: two product-scoped campaigns matching different items both reward", async () => {
            const mockRepository = createMockRepository();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaignA = {
                ...scopedCampaign([
                    { field: "productId", operator: "eq", value: "A" },
                ]),
                id: "campaign-a",
            };
            const campaignB = {
                ...scopedCampaign([
                    { field: "productId", operator: "eq", value: "B" },
                ]),
                id: "campaign-b",
            };

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaignA,
                campaignB,
            ]);
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [createMockCalculatedReward()],
                errors: [],
                deferForUnpriceableReward: false,
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                realConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const result = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: purchaseContext([
                    {
                        productId: "A",
                        name: "Widget",
                        quantity: 1,
                        unitPrice: 10,
                        totalPrice: 10,
                    },
                    {
                        productId: "B",
                        name: "Gadget",
                        quantity: 1,
                        unitPrice: 25,
                        totalPrice: 25,
                    },
                ]),
            });

            expect(result.rewards).toHaveLength(2);
            expect(mockRewardCalculator.calculateAll).toHaveBeenCalledTimes(2);
        });

        it("computes matchedAmount/matchedQuantity from matched items only", async () => {
            const mockRepository = createMockRepository();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = scopedCampaign([
                { field: "productId", operator: "eq", value: "A" },
            ]);

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [createMockCalculatedReward()],
                errors: [],
                deferForUnpriceableReward: false,
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                realConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: purchaseContext([
                    {
                        productId: "A",
                        name: "Widget",
                        quantity: 2,
                        unitPrice: 10,
                        totalPrice: 20,
                    },
                    {
                        productId: "B",
                        name: "Gadget",
                        quantity: 3,
                        unitPrice: 5,
                        totalPrice: 15,
                    },
                ]),
            });

            const [, calledContext] = vi.mocked(
                mockRewardCalculator.calculateAll
            ).mock.calls[0];
            expect(calledContext.purchase?.matchedAmount).toBe(20);
            expect(calledContext.purchase?.matchedQuantity).toBe(2);
        });

        it("negation margin case: not_in excludes the cheap SKU from both trigger and basis", async () => {
            const mockRepository = createMockRepository();
            const mockRewardCalculator = createMockRewardCalculator();
            const mockAssetLogRepository = createMockAssetLogRepository();

            const campaign = scopedCampaign([
                { field: "sku", operator: "not_in", value: ["CHEAP"] },
            ]);

            vi.mocked(mockRepository.findActiveByMerchant).mockResolvedValue([
                campaign,
            ]);
            vi.mocked(mockRewardCalculator.calculateAll).mockResolvedValue({
                calculated: [createMockCalculatedReward()],
                errors: [],
                deferForUnpriceableReward: false,
            });
            vi.mocked(mockRepository.consumeBudget).mockResolvedValue({
                success: true,
                remaining: {},
            });

            const service = new RuleEngineService(
                mockRepository,
                realConditionEvaluator,
                mockRewardCalculator,
                mockAssetLogRepository
            );

            const mixedResult = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: purchaseContext([
                    {
                        productId: "cheap-1",
                        sku: "CHEAP",
                        name: "Loss leader",
                        quantity: 1,
                        unitPrice: 1,
                        totalPrice: 1,
                    },
                    {
                        productId: "normal-1",
                        sku: "NORMAL",
                        name: "Regular",
                        quantity: 1,
                        unitPrice: 50,
                        totalPrice: 50,
                    },
                ]),
            });

            expect(mixedResult.rewards).toHaveLength(1);
            const [, mixedContext] = vi.mocked(
                mockRewardCalculator.calculateAll
            ).mock.calls[0];
            expect(mixedContext.purchase?.matchedAmount).toBe(50);

            vi.mocked(mockRewardCalculator.calculateAll).mockClear();
            vi.mocked(mockRepository.consumeBudget).mockClear();

            const cheapOnlyResult = await service.evaluateRules({
                merchantId: "merchant-1",
                trigger: "purchase",
                context: purchaseContext([
                    {
                        productId: "cheap-1",
                        sku: "CHEAP",
                        name: "Loss leader",
                        quantity: 1,
                        unitPrice: 1,
                        totalPrice: 1,
                    },
                ]),
            });

            expect(cheapOnlyResult.rewards).toEqual([]);
            expect(mockRewardCalculator.calculateAll).not.toHaveBeenCalled();
        });
    });
});
