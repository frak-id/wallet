import { IdentityRepository } from "./repositories/IdentityRepository";
import { InstallCodeRepository } from "./repositories/InstallCodeRepository";
import { WalletBindingRepository } from "./repositories/WalletBindingRepository";
import { AnonymousMergeService } from "./services/AnonymousMergeService";
import { InstallCodeService } from "./services/InstallCodeService";

const identityRepository = new IdentityRepository();
const installCodeRepository = new InstallCodeRepository();
const walletBindingRepository = new WalletBindingRepository();
const anonymousMergeService = new AnonymousMergeService(identityRepository);
const installCodeService = new InstallCodeService(installCodeRepository);

export namespace IdentityContext {
    export const repositories = {
        identity: identityRepository,
        installCode: installCodeRepository,
        walletBinding: walletBindingRepository,
    };
    export const services = {
        anonymousMerge: anonymousMergeService,
        installCode: installCodeService,
    };
}
