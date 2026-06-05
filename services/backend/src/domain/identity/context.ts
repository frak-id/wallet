import { EmailVerificationRepository } from "./repositories/EmailVerificationRepository";
import { IdentityRepository } from "./repositories/IdentityRepository";
import { InstallCodeRepository } from "./repositories/InstallCodeRepository";
import { RecoveryRepository } from "./repositories/RecoveryRepository";
import { WalletBindingRepository } from "./repositories/WalletBindingRepository";
import { AnonymousMergeService } from "./services/AnonymousMergeService";
import { EmailVerificationService } from "./services/EmailVerificationService";
import { InstallCodeService } from "./services/InstallCodeService";
import { RecoveryEmailService } from "./services/RecoveryEmailService";

const identityRepository = new IdentityRepository();
const installCodeRepository = new InstallCodeRepository();
const walletBindingRepository = new WalletBindingRepository();
const recoveryRepository = new RecoveryRepository();
const emailVerificationRepository = new EmailVerificationRepository();
const anonymousMergeService = new AnonymousMergeService(identityRepository);
const installCodeService = new InstallCodeService(installCodeRepository);
const emailVerificationService = new EmailVerificationService(
    emailVerificationRepository,
    identityRepository
);
const recoveryEmailService = new RecoveryEmailService(
    identityRepository,
    recoveryRepository
);

export namespace IdentityContext {
    export const repositories = {
        identity: identityRepository,
        installCode: installCodeRepository,
        walletBinding: walletBindingRepository,
        recovery: recoveryRepository,
        emailVerification: emailVerificationRepository,
    };
    export const services = {
        anonymousMerge: anonymousMergeService,
        installCode: installCodeService,
        emailVerification: emailVerificationService,
        recoveryEmail: recoveryEmailService,
    };
}
