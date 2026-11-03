import { currentStablecoins } from "@frak-labs/app-essentials";
import { type Address, parseUnits } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import type { OwedByBankRow } from "../../domain/rewards/repositories/AssetLogRepository";
import { FrakBankAdminOrchestrator } from "./FrakBankAdminOrchestrator";

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({ eventEmitter: { emit } }));

const NOW = new Date("2026-10-30T12:00:00Z");
const BANK = "0x00000000000000000000000000000000000000b4" as Address;
const EURE = currentStablecoins.eure;
const USDC = currentStablecoins.usdc;
const eur = (amount: string) => parseUnits(amount, 18).toString();

const none = { amount: "0", count: 0 };
const owedRow = (over: Partial<OwedByBankRow> = {}): OwedByBankRow => ({
    merchantId: FRAK_MERCHANT_ID,
    tokenAddress: EURE,
    due: none,
    depleted: none,
    processing: none,
    later: none,
    ...over,
});

function makeOrchestrator(
    opts: {
        isOpen?: boolean;
        balances?: [Address, bigint][];
        allowances?: [Address, bigint][];
        owed?: OwedByBankRow[];
        requeued?: number;
    } = {}
) {
    const clearOnChainCache = vi.fn();
    const requeueDepletedRewards = vi
        .fn()
        .mockResolvedValue({ requeuedCount: opts.requeued ?? 0 });
    const orchestrator = new FrakBankAdminOrchestrator(
        {
            findById: vi.fn().mockResolvedValue({ bankAddress: BANK }),
            findByIds: vi.fn(async (ids: string[]) =>
                ids.map((id) => ({ id, name: `name-${id}`, domain: "x.fr" }))
            ),
        } as never,
        {
            getBankOnChainState: vi.fn().mockResolvedValue({
                isOpen: opts.isOpen ?? true,
                balances: new Map(opts.balances ?? []),
                allowances: new Map(opts.allowances ?? []),
            }),
            clearOnChainCache,
        } as never,
        {
            sumOwedByBank: vi.fn().mockResolvedValue(opts.owed ?? []),
            findPayoutStates: vi.fn().mockResolvedValue([
                {
                    id: "asset-1",
                    status: "bank_depleted",
                    amount: "50",
                    tokenAddress: EURE,
                    txHash: null,
                    statusChangedAt: NOW,
                    settledAt: null,
                    expiresAt: null,
                    lastError: null,
                },
            ]),
        } as never,
        {
            findByIds: vi
                .fn()
                .mockResolvedValue([
                    { id: "game-1", prizeAmount: 50, endsAt: NOW },
                ]),
        } as never,
        {
            findConfirmedPayouts: vi.fn().mockResolvedValue([
                {
                    gameId: "game-1",
                    assetLogId: "asset-1",
                    winnerIdentityGroupId: "g1",
                    confirmedAt: NOW,
                },
            ]),
        } as never,
        {
            getDecimals: vi.fn(async ({ token }: { token: Address }) =>
                token === USDC ? 6 : 18
            ),
        } as never,
        { requeueDepletedRewards } as never
    );
    return { orchestrator, clearOnChainCache, requeueDepletedRewards };
}

beforeEach(() => emit.mockClear());

describe("FrakBankAdminOrchestrator.overview", () => {
    it("reads the Frak merchant's bank fresh, bypassing the cache", async () => {
        const { orchestrator, clearOnChainCache } = makeOrchestrator();
        const bank = await orchestrator.overview(NOW);
        expect(bank.address).toBe(BANK);
        expect(clearOnChainCache).toHaveBeenCalledWith(BANK);
    });

    it("caps what it can pay at the allowance, and owes the rest", async () => {
        const { orchestrator } = makeOrchestrator({
            balances: [[EURE, BigInt(eur("100"))]],
            allowances: [[EURE, BigInt(eur("30"))]],
            owed: [
                owedRow({
                    due: { amount: "20", count: 2 },
                    depleted: { amount: "50", count: 1 },
                    later: { amount: "500", count: 40 },
                }),
            ],
        });
        const [eure] = (await orchestrator.overview(NOW)).tokens;
        expect(eure).toMatchObject({
            symbol: "eure",
            payable: eur("30"),
            shortfall: eur("40"),
            owed: {
                due: { amount: eur("20"), count: 2 },
                depleted: { amount: eur("50"), count: 1 },
                later: { amount: eur("500"), count: 40 },
            },
        });
    });

    it("pays nothing from a closed bank, however funded", async () => {
        const { orchestrator } = makeOrchestrator({
            isOpen: false,
            balances: [[EURE, BigInt(eur("100"))]],
            allowances: [[EURE, BigInt(eur("100"))]],
            owed: [owedRow({ depleted: { amount: "50", count: 1 } })],
        });
        const [eure] = (await orchestrator.overview(NOW)).tokens;
        expect(eure).toMatchObject({ payable: "0", shortfall: eur("50") });
    });

    it("shows EURe always, other tokens only once funded or owed", async () => {
        const { orchestrator } = makeOrchestrator({
            owed: [
                owedRow({
                    tokenAddress: USDC,
                    due: { amount: "1.5", count: 1 },
                }),
            ],
        });
        const { tokens } = await orchestrator.overview(NOW);
        expect(tokens.map((token) => token.symbol)).toEqual(["eure", "usdc"]);
        expect(tokens[1]?.owed.due.amount).toBe("1500000");
    });

    it("lists the largest debtor first, with its name", async () => {
        const { orchestrator } = makeOrchestrator({
            owed: [
                owedRow({
                    merchantId: "small",
                    due: { amount: "1", count: 1 },
                }),
                owedRow({
                    merchantId: "big",
                    depleted: { amount: "9", count: 1 },
                }),
            ],
        });
        const { merchants } = await orchestrator.overview(NOW);
        expect(merchants.map((m) => [m.merchantId, m.name])).toEqual([
            ["big", "name-big"],
            ["small", "name-small"],
        ]);
    });

    it("joins each prize to its payout", async () => {
        const { orchestrator } = makeOrchestrator();
        const { prizes } = await orchestrator.overview(NOW);
        expect(prizes).toEqual([
            {
                gameId: "game-1",
                prizeAmount: 50,
                endsAt: NOW,
                confirmedAt: NOW,
                payout: expect.objectContaining({ status: "bank_depleted" }),
            },
        ]);
    });
});

describe("FrakBankAdminOrchestrator.recheck", () => {
    it("lets the requeue wake settlement when it moved something", async () => {
        const { orchestrator } = makeOrchestrator({ requeued: 3 });
        await expect(orchestrator.recheck()).resolves.toEqual({ requeued: 3 });
        expect(emit).not.toHaveBeenCalled();
    });

    it("wakes settlement itself for rewards already pending", async () => {
        const { orchestrator } = makeOrchestrator();
        await expect(orchestrator.recheck()).resolves.toEqual({ requeued: 0 });
        expect(emit).toHaveBeenCalledWith("newPendingRewards", { count: 0 });
    });
});
