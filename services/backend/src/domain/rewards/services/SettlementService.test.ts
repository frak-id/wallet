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
    const assetLogRepository = {
        markSettlementProcessing: vi.fn().mockResolvedValue(1),
        updateStatusBatch: vi.fn().mockResolvedValue(1),
        revertSettlementToPending: vi.fn().mockResolvedValue(1),
    } as unknown as AssetLogRepository;

    const pushRewards = vi.fn();
    const rewardsHub = { pushRewards } as unknown as RewardsHubRepository;

    const tokenMetadata = {
        getDecimals: vi.fn().mockResolvedValue(6),
    } as unknown as TokenMetadataRepository;

    const service = new SettlementService(
        assetLogRepository,
        rewardsHub,
        tokenMetadata
    );

    return { service, assetLogRepository, pushRewards };
};

describe("SettlementService.settleRewards", () => {
    it("reports only the asset log ids whose bank batch actually settled", async () => {
        const { service, assetLogRepository, pushRewards } = buildService();

        pushRewards.mockImplementation(async (rewards: { bank: Address }[]) => {
            if (rewards[0]?.bank === BANK_B) {
                throw new Error("bank B reverted on-chain");
            }
            return { txHash: "0xdead", blockNumber: 7n };
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
        expect(
            assetLogRepository.revertSettlementToPending
        ).toHaveBeenCalledWith(["b1"], "bank B reverted on-chain");
        expect(assetLogRepository.updateStatusBatch).toHaveBeenCalledWith(
            ["a1"],
            "settled",
            { txHash: "0xdead", blockNumber: 7n }
        );
    });

    it("reports every reward when all bank batches succeed", async () => {
        const { service, pushRewards } = buildService();
        pushRewards.mockResolvedValue({ txHash: "0xfeed", blockNumber: 9n });

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
});
