import { IdentityRepository } from "./repositories/IdentityRepository";
import { InstallCodeRepository } from "./repositories/InstallCodeRepository";
import { AnonymousMergeService } from "./services/AnonymousMergeService";
import { InstallCodeService } from "./services/InstallCodeService";

const identityRepository = new IdentityRepository();
const installCodeRepository = new InstallCodeRepository();
const anonymousMergeService = new AnonymousMergeService(identityRepository);
const installCodeService = new InstallCodeService(installCodeRepository);

export namespace IdentityContext {
    export const repositories = {
        identity: identityRepository,
        installCode: installCodeRepository,
    };
    export const services = {
        anonymousMerge: anonymousMergeService,
        installCode: installCodeService,
    };
}
