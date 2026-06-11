import type { TokenMetadataRepository } from "@backend-infrastructure";
import type { Address } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { RewardsHubRepository } from "../../../infrastructure/blockchain/contracts/RewardsHubRepository";
import type { AssetLogRepository } from "../repositories/AssetLogRepository";
import {
    type AssetLogWithWallet,
    SettlementService,
} from "./SettlementService";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TOKEN = "0x0000000000000000000000000000000000000001" as Address;
const WALLET = "0x0000000000000000000000000000000000000002" as Address;
const BANK_A = "0x000000000000000000000000000000000000000a" as Address;
const BANK_B = "0x000000000000000000000000000000000000000b" as Address;

const reward = (
    over: Partial<AssetLogWithWallet> & { id: string; merchantId: string }
): AssetLogWithWallet =>
    ({
        tokenAddress: TOKEN,
        amount: "100",
        walletAddress: WALLET,
        interactionType: null,
        createdAt: new Date(),
        ...over,
    }) as unknown as AssetLogWithWallet;

const buildService = () => {
    const markSettlementProcessing = vi.fn().mockResolvedValue(1);
    const updateStatusBatch = vi.fn().mockResolvedValue(1);
    const revertSettlementToPending = vi.fn().mockResolvedValue(1);
    const bumpAttemptAndRevert = vi.fn().mockResolvedValue(1);
    const recordSettlementBroadcast = vi.fn().mockResolvedValue(1);
    const findStuckProcessing = vi.fn().mockResolvedValue([]);
    const assetLogRepository = {
        markSettlementProcessing,
        updateStatusBatch,
        revertSettlementToPending,
        bumpAttemptAndRevert,
        recordSettlementBroadcast,
        findStuckProcessing,
    } as unknown as AssetLogRepository;

    const pushRewards = vi.fn();
    const getReceipt = vi.fn();
    const isTransactionKnown = vi.fn();
    const rewardsHub = {
        pushRewards,
        getReceipt,
        isTransactionKnown,
    } as unknown as RewardsHubRepository;

    const tokenMetadata = {
        getDecimals: vi.fn().mockResolvedValue(6),
    } as unknown as TokenMetadataRepository;

    const service = new SettlementService(
        assetLogRepository,
        rewardsHub,
        tokenMetadata
    );

    return {
        service,
        updateStatusBatch,
        revertSettlementToPending,
        bumpAttemptAndRevert,
        findStuckProcessing,
        pushRewards,
        getReceipt,
        isTransactionKnown,
    };
};

describe("SettlementService.settleRewards", () => {
    it("reports only the asset log ids whose bank batch actually settled", async () => {
        const {
            service,
            updateStatusBatch,
            revertSettlementToPending,
            pushRewards,
        } = buildService();

        pushRewards.mockImplementation(async (rewards: { bank: Address }[]) => {
            if (rewards[0]?.bank === BANK_B) {
                throw new Error("bank B reverted on-chain");
            }
            return { status: "confirmed", txHash: "0xdead", blockNumber: 7n };
        });

        const result = await service.settleRewards(
            [
                reward({ id: "a1", merchantId: "m-a" }),
                reward({ id: "b1", merchantId: "m-b" }),
            ],
            new Map<string, Address>([
                ["m-a", BANK_A],
                ["m-b", BANK_B],
            ])
        );

        expect(result.settledAssetLogIds).toEqual(["a1"]);
        expect(result.settledCount).toBe(1);
        expect(result.failedCount).toBe(1);
        expect(revertSettlementToPending).toHaveBeenCalledWith(
            ["b1"],
            "bank B reverted on-chain"
        );
        expect(updateStatusBatch).toHaveBeenCalledWith(["a1"], "settled", {
            txHash: "0xdead",
            blockNumber: 7n,
        });
    });

    it("reports every reward when all bank batches confirm", async () => {
        const { service, pushRewards } = buildService();
        pushRewards.mockResolvedValue({
            status: "confirmed",
            txHash: "0xfeed",
            blockNumber: 9n,
        });

        const result = await service.settleRewards(
            [
                reward({ id: "a1", merchantId: "m-a" }),
                reward({ id: "a2", merchantId: "m-a" }),
            ],
            new Map<string, Address>([["m-a", BANK_A]])
        );

        expect(result.settledAssetLogIds).toEqual(["a1", "a2"]);
        expect(result.settledCount).toBe(2);
        expect(result.failedCount).toBe(0);
    });

    it("reverts to pending when the tx reverts on-chain", async () => {
        const {
            service,
            updateStatusBatch,
            revertSettlementToPending,
            pushRewards,
        } = buildService();
        pushRewards.mockResolvedValue({ status: "reverted", txHash: "0xbad" });

        const result = await service.settleRewards(
            [reward({ id: "a1", merchantId: "m-a" })],
            new Map<string, Address>([["m-a", BANK_A]])
        );

        expect(result.settledAssetLogIds).toEqual([]);
        expect(result.settledCount).toBe(0);
        expect(result.failedCount).toBe(1);
        expect(revertSettlementToPending).toHaveBeenCalledWith(
            ["a1"],
            "Settlement transaction reverted on-chain"
        );
        expect(updateStatusBatch).not.toHaveBeenCalled();
    });

    it("leaves rows processing on receipt timeout (never settles or reverts)", async () => {
        const {
            service,
            updateStatusBatch,
            revertSettlementToPending,
            pushRewards,
        } = buildService();
        pushRewards.mockResolvedValue({
            status: "timeout",
            txHash: "0xpending",
        });

        const result = await service.settleRewards(
            [reward({ id: "a1", merchantId: "m-a" })],
            new Map<string, Address>([["m-a", BANK_A]])
        );

        expect(result.settledAssetLogIds).toEqual([]);
        expect(result.settledCount).toBe(0);
        expect(result.failedCount).toBe(0);
        expect(result.txHashes).toEqual(["0xpending"]);
        expect(updateStatusBatch).not.toHaveBeenCalled();
        expect(revertSettlementToPending).not.toHaveBeenCalled();
    });

    it("re-pends preparation drops with an attempt spent and never pushes", async () => {
        const { service, bumpAttemptAndRevert, pushRewards } = buildService();

        const result = await service.settleRewards(
            [reward({ id: "a1", merchantId: "m-a" })],
            new Map<string, Address>()
        );

        expect(result.failedCount).toBe(1);
        expect(result.settledCount).toBe(0);
        expect(bumpAttemptAndRevert).toHaveBeenCalledWith(
            ["a1"],
            "Settlement preparation failed"
        );
        expect(pushRewards).not.toHaveBeenCalled();
    });
});

describe("SettlementService.reconcileStuckSettlements", () => {
    it("settles rows whose shared batch tx confirmed", async () => {
        const { service, findStuckProcessing, updateStatusBatch, getReceipt } =
            buildService();
        findStuckProcessing.mockResolvedValue([
            { id: "a1", onchainTxHash: "0xaaa" },
            { id: "a2", onchainTxHash: "0xaaa" },
        ]);
        getReceipt.mockResolvedValue({ status: "success", blockNumber: 5n });

        const result = await service.reconcileStuckSettlements(30);

        expect(updateStatusBatch).toHaveBeenCalledWith(
            ["a1", "a2"],
            "settled",
            {
                txHash: "0xaaa",
                blockNumber: 5n,
            }
        );
        expect(result).toEqual({ settled: 2, reverted: 0, pending: 0 });
    });

    it("reverts rows whose tx reverted on-chain", async () => {
        const {
            service,
            findStuckProcessing,
            revertSettlementToPending,
            getReceipt,
        } = buildService();
        findStuckProcessing.mockResolvedValue([
            { id: "a1", onchainTxHash: "0xbad" },
        ]);
        getReceipt.mockResolvedValue({ status: "reverted", blockNumber: 5n });

        const result = await service.reconcileStuckSettlements(30);

        expect(revertSettlementToPending).toHaveBeenCalledWith(
            ["a1"],
            "Settlement tx reverted on-chain"
        );
        expect(result).toEqual({ settled: 0, reverted: 1, pending: 0 });
    });

    it("leaves rows whose tx is still known to the mempool", async () => {
        const {
            service,
            findStuckProcessing,
            revertSettlementToPending,
            updateStatusBatch,
            getReceipt,
            isTransactionKnown,
        } = buildService();
        findStuckProcessing.mockResolvedValue([
            { id: "a1", onchainTxHash: "0xlive" },
        ]);
        getReceipt.mockResolvedValue(null);
        isTransactionKnown.mockResolvedValue(true);

        const result = await service.reconcileStuckSettlements(30);

        expect(revertSettlementToPending).not.toHaveBeenCalled();
        expect(updateStatusBatch).not.toHaveBeenCalled();
        expect(result).toEqual({ settled: 0, reverted: 0, pending: 1 });
    });

    it("reverts rows whose tx was dropped from the mempool", async () => {
        const {
            service,
            findStuckProcessing,
            revertSettlementToPending,
            getReceipt,
            isTransactionKnown,
        } = buildService();
        findStuckProcessing.mockResolvedValue([
            { id: "a1", onchainTxHash: "0xgone" },
        ]);
        getReceipt.mockResolvedValue(null);
        isTransactionKnown.mockResolvedValue(false);

        const result = await service.reconcileStuckSettlements(30);

        expect(revertSettlementToPending).toHaveBeenCalledWith(
            ["a1"],
            "Settlement tx dropped from mempool"
        );
        expect(result).toEqual({ settled: 0, reverted: 1, pending: 0 });
    });

    it("reverts rows that never broadcast without touching the chain", async () => {
        const {
            service,
            findStuckProcessing,
            revertSettlementToPending,
            getReceipt,
        } = buildService();
        findStuckProcessing.mockResolvedValue([
            { id: "x1", onchainTxHash: null },
        ]);

        const result = await service.reconcileStuckSettlements(30);

        expect(revertSettlementToPending).toHaveBeenCalledWith(
            ["x1"],
            "Stuck in processing without a broadcast tx"
        );
        expect(getReceipt).not.toHaveBeenCalled();
        expect(result).toEqual({ settled: 0, reverted: 1, pending: 0 });
    });
});
