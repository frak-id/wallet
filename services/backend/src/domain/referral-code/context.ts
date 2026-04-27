import { ReferralCodeRepository } from "./repositories/ReferralCodeRepository";
import { ReferralCodeService } from "./services/ReferralCodeService";

const referralCodeRepository = new ReferralCodeRepository();
const referralCodeService = new ReferralCodeService(referralCodeRepository);

export namespace ReferralCodeContext {
    export const repositories = {
        referralCode: referralCodeRepository,
    };
    export const services = {
        referralCode: referralCodeService,
    };
}
