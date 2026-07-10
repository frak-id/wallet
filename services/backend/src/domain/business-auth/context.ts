import { BusinessAccountRepository } from "./repositories/BusinessAccountRepository";
import { BusinessCredentialRepository } from "./repositories/BusinessCredentialRepository";
import { BusinessEmailCodeRepository } from "./repositories/BusinessEmailCodeRepository";
import { BusinessSessionRepository } from "./repositories/BusinessSessionRepository";
import { BusinessTotpRepository } from "./repositories/BusinessTotpRepository";
import { BusinessAccountService } from "./services/BusinessAccountService";
import { BusinessSessionService } from "./services/BusinessSessionService";
import { EmailOtpService } from "./services/EmailOtpService";
import { PasswordService } from "./services/PasswordService";
import { ShopifySsoService } from "./services/ShopifySsoService";
import { TotpService } from "./services/TotpService";

const businessAccountRepository = new BusinessAccountRepository();
const businessCredentialRepository = new BusinessCredentialRepository();
const businessSessionRepository = new BusinessSessionRepository();
const businessEmailCodeRepository = new BusinessEmailCodeRepository();
const businessTotpRepository = new BusinessTotpRepository();

const passwordService = new PasswordService();
const businessSessionService = new BusinessSessionService(
    businessSessionRepository
);
const emailOtpService = new EmailOtpService(businessEmailCodeRepository);
const totpService = new TotpService(businessTotpRepository);
const businessAccountService = new BusinessAccountService(
    businessAccountRepository,
    businessCredentialRepository,
    businessTotpRepository
);
const shopifySsoService = new ShopifySsoService();

export namespace BusinessAuthContext {
    export const repositories = {
        account: businessAccountRepository,
        credential: businessCredentialRepository,
        session: businessSessionRepository,
        emailCode: businessEmailCodeRepository,
        totp: businessTotpRepository,
    };
    export const services = {
        account: businessAccountService,
        password: passwordService,
        session: businessSessionService,
        emailOtp: emailOtpService,
        totp: totpService,
        shopifySso: shopifySsoService,
    };
}
