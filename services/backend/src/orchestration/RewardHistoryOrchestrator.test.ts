import { describe, expect, it, vi } from "vitest";
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
