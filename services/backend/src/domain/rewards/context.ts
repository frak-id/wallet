import { AssetLogRepository } from "./repositories/AssetLogRepository";
import { InteractionLogRepository } from "./repositories/InteractionLogRepository";
import { SettlementService } from "./services/SettlementService";

const assetLogRepository = new AssetLogRepository();
const interactionLogRepository = new InteractionLogRepository();
const settlementService = new SettlementService();

export namespace RewardsContext {
    export const repositories = {
        assetLog: assetLogRepository,
        interactionLog: interactionLogRepository,
    };

    export const services = {
        settlement: settlementService,
    };
}
