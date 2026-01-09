import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { MerchantRepository } from "../domain/merchant/repositories/MerchantRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type {
    AssetLogWithWallet,
    SettlementService,
} from "../domain/rewards/services/SettlementService";
import type { SettlementResult } from "../domain/rewards/types";

const SETTLEMENT_BATCH_SIZE = 100;

export class SettlementOrchestrator {
    constructor(
        private readonly settlementService: SettlementService,
        private readonly assetLogRepository: AssetLogRepository,
        private readonly merchantRepository: MerchantRepository
    ) {}

    async runSettlement(): Promise<SettlementResult> {
        const pendingRewards =
            await this.assetLogRepository.findPendingForSettlement(
                SETTLEMENT_BATCH_SIZE
            );

        if (pendingRewards.length === 0) {
            log.debug("No pending rewards to settle");
            return {
                pushedCount: 0,
                lockedCount: 0,
                failedCount: 0,
                txHashes: [],
                errors: [],
            };
        }

        const merchantBanks = await this.getMerchantBanks(pendingRewards);

        return this.settlementService.settleRewards(
            pendingRewards,
            merchantBanks
        );
    }

    private async getMerchantBanks(
        rewards: AssetLogWithWallet[]
    ): Promise<Map<string, Address>> {
        const merchantBanks = new Map<string, Address>();
        const merchantIds = [...new Set(rewards.map((r) => r.merchantId))];

        for (const merchantId of merchantIds) {
            const merchant = await this.merchantRepository.findById(merchantId);
            if (merchant?.bankAddress) {
                merchantBanks.set(merchantId, merchant.bankAddress);
            }
        }

        return merchantBanks;
    }
}
