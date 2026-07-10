import { adminWalletsRepository } from "@backend-infrastructure";
import { BusinessAccountRepository } from "./repositories/BusinessAccountRepository";
import { BusinessEmailCodeRepository } from "./repositories/BusinessEmailCodeRepository";
import { BusinessSessionRepository } from "./repositories/BusinessSessionRepository";
import { BusinessAccountService } from "./services/BusinessAccountService";
import { BusinessSessionService } from "./services/BusinessSessionService";
import { EmailOtpService } from "./services/EmailOtpService";
import { PasswordService } from "./services/PasswordService";
import { ShopifySsoService } from "./services/ShopifySsoService";
import { TotpService } from "./services/TotpService";

const businessAccountRepository = new BusinessAccountRepository();
const businessSessionRepository = new BusinessSessionRepository();
const businessEmailCodeRepository = new BusinessEmailCodeRepository();

const passwordService = new PasswordService();
const businessSessionService = new BusinessSessionService(
    businessSessionRepository
);
const emailOtpService = new EmailOtpService(businessEmailCodeRepository);
const totpService = new TotpService(
    businessAccountRepository,
    adminWalletsRepository
);
const businessAccountService = new BusinessAccountService(
    businessAccountRepository
);
const shopifySsoService = new ShopifySsoService();

export namespace BusinessAuthContext {
    export const repositories = {
        account: businessAccountRepository,
        session: businessSessionRepository,
        emailCode: businessEmailCodeRepository,
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
