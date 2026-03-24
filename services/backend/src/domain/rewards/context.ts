import { rewardsHubRepository } from "../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { tokenMetadataRepository } from "../../infrastructure/blockchain/TokenMetadataRepository";
import { AssetLogRepository } from "./repositories/AssetLogRepository";
import { InteractionLogRepository } from "./repositories/InteractionLogRepository";
import { RewardHistoryService } from "./services/RewardHistoryService";
import { SettlementService } from "./services/SettlementService";

const assetLogRepository = new AssetLogRepository();
const interactionLogRepository = new InteractionLogRepository();
const settlementService = new SettlementService(
    assetLogRepository,
    rewardsHubRepository,
    tokenMetadataRepository
);
const rewardHistoryService = new RewardHistoryService();

export namespace RewardsContext {
    export const repositories = {
        assetLog: assetLogRepository,
        interactionLog: interactionLogRepository,
    };

    export const services = {
        settlement: settlementService,
        rewardHistory: rewardHistoryService,
    };
}
