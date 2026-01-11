import { log } from "@backend-infrastructure";
import { encodeUserId } from "@backend-utils";
import type { Hex } from "viem";
import type {
    ResolveOp,
    RewardsHubRepository,
} from "../../../infrastructure/blockchain/contracts/RewardsHubRepository";
import type { PendingIdentityResolutionRepository } from "../repositories/PendingIdentityResolutionRepository";

const BATCH_SIZE = 200;

type ResolutionResult = {
    processedCount: number;
    successCount: number;
    failedCount: number;
    txHash: Hex | null;
};

export class IdentityResolutionBatchService {
    constructor(
        private readonly pendingResolutionRepository: PendingIdentityResolutionRepository,
        private readonly rewardsHub: RewardsHubRepository
    ) {}

    async processPendingResolutions(): Promise<ResolutionResult> {
        const result: ResolutionResult = {
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            txHash: null,
        };

        await this.pendingResolutionRepository.resetStuckProcessing(30);

        const pending =
            await this.pendingResolutionRepository.findPendingForProcessing(
                BATCH_SIZE
            );

        if (pending.length === 0) {
            log.debug("No pending identity resolutions to process");
            return result;
        }

        result.processedCount = pending.length;

        const ids = pending.map((p) => p.id);
        await this.pendingResolutionRepository.markProcessing(ids);

        const resolveOps: ResolveOp[] = pending.map((item) => ({
            userId: encodeUserId(item.groupId),
            wallet: item.walletAddress,
        }));

        try {
            const txResult = await this.rewardsHub.resolveUserIds(resolveOps);

            await this.pendingResolutionRepository.markCompleted(ids, {
                txHash: txResult.txHash,
                blockNumber: txResult.blockNumber,
            });

            result.successCount = pending.length;
            result.txHash = txResult.txHash;

            log.info(
                {
                    count: pending.length,
                    txHash: txResult.txHash,
                    blockNumber: txResult.blockNumber,
                },
                "Batch resolved userIds on RewardsHub"
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);

            await this.pendingResolutionRepository.revertToPending(ids);
            result.failedCount = pending.length;

            log.error(
                {
                    count: pending.length,
                    error: errorMessage,
                },
                "Failed to resolve userIds batch"
            );
        }

        return result;
    }
}
