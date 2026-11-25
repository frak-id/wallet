import { log as logger } from "@backend-infrastructure";
import { describe, expect, it, vi } from "vitest";
import { RewardHistoryService } from "../domain/rewards/services/RewardHistoryService";
import { RewardHistoryOrchestrator } from "./RewardHistoryOrchestrator";

vi.mock("@backend-infrastructure", () => ({ log: { warn: vi.fn() } }));

const WALLET = "0x0000000000000000000000000000000000000001";
const EURE = "0x00000000000000000000000000000000000000e1";
const USDC = "0x00000000000000000000000000000000000000c1";

function makeOrchestrator(opts: {
    group: { id: string } | null;
    totals?: Array<{ tokenAddress: string; total: string }>;
    prices?: Record<string, { eur: number } | undefined>;
}) {
    const sumUnpaidByIdentityGroup = vi
        .fn()
        .mockResolvedValue(opts.totals ?? []);
    const orchestrator = new RewardHistoryOrchestrator(
        { sumUnpaidByIdentityGroup } as never,
        {
            findGroupByIdentity: vi.fn().mockResolvedValue(opts.group),
        } as never,
        {} as never,
        {} as never,
        {
            getTokenPrice: vi.fn(
                async ({ token }: { token: string }) => opts.prices?.[token]
            ),
        } as never,
        {} as never,
        {} as never,
        {} as never
    );
    return { orchestrator, sumUnpaidByIdentityGroup };
}

describe("RewardHistoryOrchestrator.getUnpaidTotal", () => {
    it("returns 0 for a wallet without identity group", async () => {
        const { orchestrator, sumUnpaidByIdentityGroup } = makeOrchestrator({
            group: null,
        });

        await expect(orchestrator.getUnpaidTotal(WALLET)).resolves.toEqual({
            eurAmount: 0,
        });
        expect(sumUnpaidByIdentityGroup).not.toHaveBeenCalled();
    });

    it("sums the unpaid totals of every token in EUR", async () => {
        const { orchestrator, sumUnpaidByIdentityGroup } = makeOrchestrator({
            group: { id: "group-1" },
            totals: [
                { tokenAddress: EURE, total: "1.5" },
                { tokenAddress: USDC, total: "2" },
            ],
            prices: { [EURE]: { eur: 1 }, [USDC]: { eur: 0.9 } },
        });

        await expect(orchestrator.getUnpaidTotal(WALLET)).resolves.toEqual({
            eurAmount: 3.3,
        });
        expect(sumUnpaidByIdentityGroup).toHaveBeenCalledWith("group-1");
    });

    it("leaves out a token without a price", async () => {
        const { orchestrator } = makeOrchestrator({
            group: { id: "group-1" },
            totals: [
                { tokenAddress: EURE, total: "1" },
                { tokenAddress: USDC, total: "5" },
            ],
            prices: { [EURE]: { eur: 1 } },
        });

        await expect(orchestrator.getUnpaidTotal(WALLET)).resolves.toEqual({
            eurAmount: 1,
        });
    });
});

describe("RewardHistoryOrchestrator.getMerchantRewardSummary", () => {
    const params = { anonymousId: "anon-1", merchantId: "merchant-1" };

    function makeSummaryOrchestrator(opts: {
        group: { id: string } | null;
        wallet?: string | null;
        rows?: unknown[];
        getTokenPrice?: ReturnType<typeof vi.fn>;
    }) {
        const findSummaryRowsByIdentityGroupAndMerchant = vi
            .fn()
            .mockResolvedValue(opts.rows ?? []);
        const findGroupByIdentity = vi.fn().mockResolvedValue(opts.group);
        const orchestrator = new RewardHistoryOrchestrator(
            { findSummaryRowsByIdentityGroupAndMerchant } as never,
            {
                findGroupByIdentity,
                getWalletForGroup: vi.fn().mockResolvedValue(opts.wallet),
            } as never,
            {} as never,
            {} as never,
            {
                getTokenPrice:
                    opts.getTokenPrice ??
                    vi.fn().mockResolvedValue({ eur: 1, usd: 1, gbp: 1 }),
            } as never,
            {} as never,
            {} as never,
            {} as never
        );
        return {
            orchestrator,
            findGroupByIdentity,
            findSummaryRowsByIdentityGroupAndMerchant,
        };
    }

    const row = (status: string) => ({
        status,
        amount: "2",
        tokenAddress: EURE,
        recipientType: "referee",
        availableAt: null,
        held: false,
        expiresAt: null,
    });

    it("answers an empty unlinked summary for an unknown identity", async () => {
        const { orchestrator, findGroupByIdentity, ...repos } =
            makeSummaryOrchestrator({ group: null });

        await expect(
            orchestrator.getMerchantRewardSummary(params)
        ).resolves.toEqual({ linked: false, pending: null, earned: null });
        expect(findGroupByIdentity).toHaveBeenCalledWith({
            type: "anonymous_fingerprint",
            value: "anon-1",
            merchantId: "merchant-1",
        });
        expect(
            repos.findSummaryRowsByIdentityGroupAndMerchant
        ).not.toHaveBeenCalled();
    });

    it("reports pending rewards of an unlinked group", async () => {
        const { orchestrator, findSummaryRowsByIdentityGroupAndMerchant } =
            makeSummaryOrchestrator({
                group: { id: "group-1" },
                wallet: null,
                rows: [row("pending"), row("settled")],
            });

        const summary = await orchestrator.getMerchantRewardSummary(params);

        expect(summary.linked).toBe(false);
        expect(summary.pending?.total.eurAmount).toBe(2);
        expect(summary.earned).toBeNull();
        expect(findSummaryRowsByIdentityGroupAndMerchant).toHaveBeenCalledWith(
            "group-1",
            "merchant-1"
        );
    });

    it("reports earned rewards once the group has a wallet", async () => {
        const { orchestrator, findSummaryRowsByIdentityGroupAndMerchant } =
            makeSummaryOrchestrator({
                group: { id: "group-1" },
                wallet: WALLET,
                rows: [row("settled")],
            });

        const summary = await orchestrator.getMerchantRewardSummary(params);

        expect(summary.linked).toBe(true);
        expect(summary.earned?.total.eurAmount).toBe(2);
        expect(findSummaryRowsByIdentityGroupAndMerchant).toHaveBeenCalledWith(
            "group-1",
            "merchant-1"
        );
    });

    it("treats a token whose price lookup fails as unpriced", async () => {
        const { orchestrator } = makeSummaryOrchestrator({
            group: { id: "group-1" },
            wallet: null,
            rows: [row("pending")],
            getTokenPrice: vi.fn().mockRejectedValue(new Error("down")),
        });

        await expect(
            orchestrator.getMerchantRewardSummary(params)
        ).resolves.toEqual({ linked: false, pending: null, earned: null });
    });
});

describe("RewardHistoryOrchestrator.getHistory with a subscription plan", () => {
    const log = (step: number, role: "referrer" | "referee") => ({
        id: `${role}-${step}`,
        amount: "5",
        tokenAddress: EURE,
        status: "pending",
        recipientType: role,
        createdAt: new Date("2026-10-01"),
        settledAt: null,
        availableAt: null,
        held: step > 1,
        planStep: step,
        campaignRuleId: "campaign-1",
        interactionLogId: "interaction-1",
        cancellationReason: null,
        onchainTxHash: null,
        interactionType: "purchase",
        interactionPayload: null,
        referralLinkId: null,
        identityGroupId: "group-1",
        merchantId: "merchant-1",
        merchantName: "Brand",
        merchantDomain: "brand.com",
        merchantExplorerConfig: null,
    });

    function setup(role: "referrer" | "referee", campaignMissing = false) {
        const findPlanSteps = vi
            .fn()
            .mockResolvedValue([log(2, role), log(3, role)]);
        const findById = vi.fn().mockResolvedValue(
            campaignMissing
                ? null
                : {
                      id: "campaign-1",
                      rule: {
                          rewards: [
                              {
                                  recipient: role,
                                  type: "token",
                                  amountType: "percentage",
                                  percent: 10,
                                  percentOf: "purchase_amount",
                                  cycles: { from: 1, to: 3 },
                              },
                          ],
                      },
                  }
        );
        const orchestrator = new RewardHistoryOrchestrator(
            {
                findDetailedByIdentityGroup: vi
                    .fn()
                    .mockResolvedValue([log(1, role)]),
                countByIdentityGroup: vi.fn().mockResolvedValue(1),
                findPlanSteps,
            } as never,
            {
                findGroupByIdentity: vi
                    .fn()
                    .mockResolvedValue({ id: "group-1" }),
            } as never,
            {} as never,
            {
                getTokenMetadataBatch: vi.fn().mockResolvedValue(new Map()),
            } as never,
            {
                getTokenPrice: vi.fn().mockResolvedValue({
                    eur: 1,
                    usd: 1,
                    gbp: 1,
                }),
            } as never,
            new RewardHistoryService(),
            {} as never,
            {} as never,
            { findById } as never
        );
        return { orchestrator, findPlanSteps, findById };
    }

    it("fetches the later steps of the plans on the page and collapses them", async () => {
        const { orchestrator, findPlanSteps, findById } = setup("referee");

        const { items, totalCount } = await orchestrator.getHistory(WALLET, {
            limit: 20,
            offset: 0,
        });

        expect(findPlanSteps).toHaveBeenCalledWith("group-1", [
            "interaction-1",
        ]);
        expect(findById).toHaveBeenCalledWith("campaign-1");
        expect(totalCount).toBe(1);
        expect(items).toHaveLength(1);
        expect(items[0]?.plan).toMatchObject({
            stepsTotal: 3,
            estimated: true,
        });
    });

    it("does not tell a referrer they are waiting on their friend's mission", async () => {
        const { orchestrator } = setup("referrer");

        const { items } = await orchestrator.getHistory(WALLET, {
            limit: 20,
            offset: 0,
        });

        expect(items[0]?.status).toBe("pending");
        expect(items[0]).not.toHaveProperty("waitsOnFriend");
    });

    it("warns when a plan row's campaign no longer exists", async () => {
        const { orchestrator } = setup("referee", true);

        await orchestrator.getHistory(WALLET, { limit: 20, offset: 0 });

        expect(logger.warn).toHaveBeenCalledWith(
            { campaignIds: ["campaign-1"] },
            "Plan rows reference missing campaigns"
        );
    });
});
