import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { MerchantRepository } from "../domain/merchant/repositories/MerchantRepository";
import { RewardConfig } from "../domain/rewards/config";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type {
    AssetLogWithWallet,
    SettlementService,
} from "../domain/rewards/services/SettlementService";
import type { SettlementResult } from "../domain/rewards/types";

export class SettlementOrchestrator {
    constructor(
        private readonly settlementService: SettlementService,
        private readonly assetLogRepository: AssetLogRepository,
        private readonly merchantRepository: MerchantRepository
    ) {}

    async runSettlement(): Promise<SettlementResult> {
        const resetCount =
            await this.assetLogRepository.resetStuckSettlementProcessing(
                RewardConfig.settlement.stuckThresholdMinutes
            );
        if (resetCount > 0) {
            log.info({ resetCount }, "Reset stuck settlement processing items");
        }

        const pendingRewards =
            await this.assetLogRepository.findPendingForSettlement(
                RewardConfig.settlement.batchSize
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
        const merchantIds = [...new Set(rewards.map((r) => r.merchantId))];
        return this.merchantRepository.getBankAddresses(merchantIds);
    }
}
