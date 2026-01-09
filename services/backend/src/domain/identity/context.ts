import { rewardsHubRepository } from "../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { IdentityRepository } from "./repositories/IdentityRepository";
import { IdentityResolutionService } from "./services/IdentityResolutionService";

const identityRepository = new IdentityRepository();
const identityResolutionService = new IdentityResolutionService(
    identityRepository,
    rewardsHubRepository
);

export namespace IdentityContext {
    export const repositories = {
        identity: identityRepository,
    };

    export const services = {
        identityResolution: identityResolutionService,
    };
}
