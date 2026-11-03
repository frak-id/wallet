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
