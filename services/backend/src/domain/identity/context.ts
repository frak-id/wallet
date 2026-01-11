import { rewardsHubRepository } from "../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { IdentityRepository } from "./repositories/IdentityRepository";
import { PendingIdentityResolutionRepository } from "./repositories/PendingIdentityResolutionRepository";
import { IdentityResolutionBatchService } from "./services/IdentityResolutionBatchService";

const identityRepository = new IdentityRepository();
const pendingIdentityResolutionRepository =
    new PendingIdentityResolutionRepository();

const identityResolutionBatchService = new IdentityResolutionBatchService(
    pendingIdentityResolutionRepository,
    rewardsHubRepository
);

export namespace IdentityContext {
    export const repositories = {
        identity: identityRepository,
        pendingResolution: pendingIdentityResolutionRepository,
    };

    export const services = {
        identityResolutionBatch: identityResolutionBatchService,
    };
}
