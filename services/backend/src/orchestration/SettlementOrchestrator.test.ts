import type { TokenMetadataRepository } from "@backend-infrastructure";
import { type Address, parseUnits } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignBankRepository } from "../domain/campaign-bank/repositories/CampaignBankRepository";
import type { IdentityRepository } from "../domain/identity/repositories/IdentityRepository";
import type { MerchantRepository } from "../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { SettlementService } from "../domain/rewards/services/SettlementService";
import { SettlementOrchestrator } from "./SettlementOrchestrator";

const { emitMock } = vi.hoisted(() => ({ emitMock: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    eventEmitter: { emit: emitMock },
}));

const TOKEN = "0x0000000000000000000000000000000000000001" as Address;
const BANK_LIVE = "0x0000000000000000000000000000000000000011" as Address;
const BANK_EMPTY = "0x0000000000000000000000000000000000000012" as Address;

type BankState = Awaited<
    ReturnType<CampaignBankRepository["getBankOnChainState"]>
>;

const bankState = (over: Partial<BankState> = {}): BankState => ({
    isOpen: true,
    balances: new Map(),
    allowances: new Map(),
    ...over,
});

const fundedState = (amount: bigint) =>
    bankState({
        balances: new Map([[TOKEN, amount]]),
        allowances: new Map([[TOKEN, amount]]),
    });

type DepletedGroup = {
    merchantId: string;
    tokenAddress: Address;
    minAmount: string;
};

const buildOrchestrator = (opts: {
    groups?: DepletedGroup[];
    banks?: [string, Address][];
    states?: [Address, BankState][];
    requeuedRows?: number;
}) => {
    const requeueDepletedToPending = vi
        .fn()
        .mockResolvedValue(opts.requeuedRows ?? 0);
    const assetLog = {
        findDepletedAmountsByMerchantAndToken: vi
            .fn()
            .mockResolvedValue(opts.groups ?? []),
        requeueDepletedToPending,
    } as unknown as AssetLogRepository;

    const merchant = {
        getBankAddresses: vi
            .fn()
            .mockResolvedValue(new Map<string, Address>(opts.banks ?? [])),
    } as unknown as MerchantRepository;

    const stateByBank = new Map<Address, BankState>(opts.states ?? []);
    const clearOnChainCache = vi.fn();
    const campaignBank = {
        clearOnChainCache,
        getBankOnChainState: vi
            .fn()
            .mockImplementation(
                async (bank: Address) =>
                    stateByBank.get(bank) ?? bankState({ isOpen: false })
            ),
    } as unknown as CampaignBankRepository;

    const tokenMetadata = {
        getDecimals: vi.fn().mockResolvedValue(6),
    } as unknown as TokenMetadataRepository;

    const orchestrator = new SettlementOrchestrator(
        {} as unknown as SettlementService,
        assetLog,
        merchant,
        {} as unknown as IdentityRepository,
        {} as unknown as InteractionLogRepository,
        campaignBank,
        tokenMetadata
    );

    return { orchestrator, requeueDepletedToPending, clearOnChainCache };
};

describe("SettlementOrchestrator.requeueDepletedRewards", () => {
    beforeEach(() => emitMock.mockClear());

    it("requeues only groups whose bank covers the smallest depleted reward", async () => {
        const { orchestrator, requeueDepletedToPending } = buildOrchestrator({
            groups: [
                { merchantId: "m-live", tokenAddress: TOKEN, minAmount: "10" },
                { merchantId: "m-empty", tokenAddress: TOKEN, minAmount: "10" },
            ],
            banks: [
                ["m-live", BANK_LIVE],
                ["m-empty", BANK_EMPTY],
            ],
            states: [
                [BANK_LIVE, fundedState(parseUnits("50", 6))],
                [BANK_EMPTY, fundedState(0n)],
            ],
            requeuedRows: 2,
        });

        const result = await orchestrator.requeueDepletedRewards();

        expect(requeueDepletedToPending).toHaveBeenCalledWith([
            { merchantId: "m-live", tokenAddress: TOKEN },
        ]);
        expect(result.requeuedCount).toBe(2);
        expect(emitMock).toHaveBeenCalledWith("newPendingRewards", {
            count: 2,
        });
    });

    it("forces a fresh bank read before deciding", async () => {
        const { orchestrator, clearOnChainCache } = buildOrchestrator({
            groups: [
                { merchantId: "m-live", tokenAddress: TOKEN, minAmount: "10" },
            ],
            banks: [["m-live", BANK_LIVE]],
            states: [[BANK_LIVE, fundedState(parseUnits("50", 6))]],
            requeuedRows: 1,
        });

        await orchestrator.requeueDepletedRewards();

        expect(clearOnChainCache).toHaveBeenCalledWith(BANK_LIVE);
    });

    it("skips a closed bank even when it is funded", async () => {
        const { orchestrator, requeueDepletedToPending } = buildOrchestrator({
            groups: [
                { merchantId: "m-live", tokenAddress: TOKEN, minAmount: "10" },
            ],
            banks: [["m-live", BANK_LIVE]],
            states: [
                [
                    BANK_LIVE,
                    bankState({
                        isOpen: false,
                        balances: new Map([[TOKEN, parseUnits("50", 6)]]),
                        allowances: new Map([[TOKEN, parseUnits("50", 6)]]),
                    }),
                ],
            ],
        });

        const result = await orchestrator.requeueDepletedRewards();

        expect(requeueDepletedToPending).not.toHaveBeenCalled();
        expect(result.requeuedCount).toBe(0);
        expect(emitMock).not.toHaveBeenCalled();
    });

    it("skips when allowance is below the minimum even if the balance covers it", async () => {
        const { orchestrator, requeueDepletedToPending } = buildOrchestrator({
            groups: [
                { merchantId: "m-live", tokenAddress: TOKEN, minAmount: "10" },
            ],
            banks: [["m-live", BANK_LIVE]],
            states: [
                [
                    BANK_LIVE,
                    bankState({
                        balances: new Map([[TOKEN, parseUnits("50", 6)]]),
                        allowances: new Map([[TOKEN, parseUnits("5", 6)]]),
                    }),
                ],
            ],
        });

        const result = await orchestrator.requeueDepletedRewards();

        expect(requeueDepletedToPending).not.toHaveBeenCalled();
        expect(result.requeuedCount).toBe(0);
    });

    it("no-ops when there are no depleted rewards", async () => {
        const { orchestrator, requeueDepletedToPending } = buildOrchestrator({
            groups: [],
        });

        const result = await orchestrator.requeueDepletedRewards();

        expect(result.requeuedCount).toBe(0);
        expect(requeueDepletedToPending).not.toHaveBeenCalled();
        expect(emitMock).not.toHaveBeenCalled();
    });
});

describe("SettlementOrchestrator.runSettlement", () => {
    it("re-pends a wallet-less claimed row without spending an attempt and never settles it", async () => {
        const reconcileStuckSettlements = vi
            .fn()
            .mockResolvedValue({ settled: 0, reverted: 0, pending: 0 });
        const settleRewards = vi.fn();
        const settlementService = {
            reconcileStuckSettlements,
            settleRewards,
        } as unknown as SettlementService;

        const revertSettlementToPending = vi.fn().mockResolvedValue(1);
        const bumpAttemptAndRevert = vi.fn().mockResolvedValue(1);
        const assetLog = {
            claimPendingForSettlement: vi.fn().mockResolvedValue([
                {
                    id: "a1",
                    identityGroupId: "g1",
                    interactionLogId: null,
                    merchantId: "m1",
                },
            ]),
            revertSettlementToPending,
            bumpAttemptAndRevert,
        } as unknown as AssetLogRepository;

        const identity = {
            getWalletForGroup: vi.fn().mockResolvedValue(null),
        } as unknown as IdentityRepository;

        const interaction = {
            getTypesByIds: vi.fn().mockResolvedValue(new Map()),
        } as unknown as InteractionLogRepository;

        const orchestrator = new SettlementOrchestrator(
            settlementService,
            assetLog,
            {} as unknown as MerchantRepository,
            identity,
            interaction,
            {} as unknown as CampaignBankRepository,
            {} as unknown as TokenMetadataRepository
        );

        await orchestrator.runSettlement();

        // No-wallet is transient (fingerprint referrers link a wallet later),
        // so the row reverts to `pending` with no attempt spent — burning
        // `maxAttempts` would forfeit owed rewards at expiry.
        expect(revertSettlementToPending).toHaveBeenCalledWith(
            ["a1"],
            "No wallet for identity group"
        );
        expect(bumpAttemptAndRevert).not.toHaveBeenCalled();
        expect(settleRewards).not.toHaveBeenCalled();
    });
});
