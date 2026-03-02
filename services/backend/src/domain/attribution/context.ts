import { ReferralLinkRepository } from "./repositories/ReferralLinkRepository";
import { TouchpointRepository } from "./repositories/TouchpointRepository";
import { AttributionService } from "./services/AttributionService";
import { ReferralService } from "./services/ReferralService";

const touchpointRepository = new TouchpointRepository();
const referralLinkRepository = new ReferralLinkRepository();

const referralService = new ReferralService(referralLinkRepository);
const attributionService = new AttributionService(
    touchpointRepository,
    referralService
);

export namespace AttributionContext {
    export const repositories = {
        touchpoint: touchpointRepository,
        referralLink: referralLinkRepository,
    };

    export const services = {
        attribution: attributionService,
        referral: referralService,
    };
}
