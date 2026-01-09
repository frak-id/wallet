import { ReferralLinkRepository } from "./repositories/ReferralLinkRepository";
import { ReferralService } from "./services/ReferralService";

const referralLinkRepository = new ReferralLinkRepository();
const referralService = new ReferralService(referralLinkRepository);

export namespace ReferralContext {
    export const repositories = {
        referralLink: referralLinkRepository,
    };

    export const services = {
        referral: referralService,
    };
}
