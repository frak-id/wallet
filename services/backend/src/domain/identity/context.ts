import { rewardsHubRepository } from "../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { IdentityRepository } from "./repositories/IdentityRepository";
import { PendingIdentityResolutionRepository } from "./repositories/PendingIdentityResolutionRepository";
import { IdentityResolutionBatchService } from "./services/IdentityResolutionBatchService";
import { IdentityResolutionService } from "./services/IdentityResolutionService";

const identityRepository = new IdentityRepository();
const pendingIdentityResolutionRepository =
    new PendingIdentityResolutionRepository();

const identityResolutionService = new IdentityResolutionService(
    identityRepository
);

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
        identityResolution: identityResolutionService,
        identityResolutionBatch: identityResolutionBatchService,
    };
}
