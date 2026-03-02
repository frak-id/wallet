import { IdentityRepository } from "./repositories/IdentityRepository";
import { AnonymousMergeService } from "./services/AnonymousMergeService";

const identityRepository = new IdentityRepository();
const anonymousMergeService = new AnonymousMergeService(identityRepository);

export namespace IdentityContext {
    export const repositories = {
        identity: identityRepository,
    };
    export const services = {
        anonymousMerge: anonymousMergeService,
    };
}
