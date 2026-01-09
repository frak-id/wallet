import { ReferralContext } from "../referral/context";
import { TouchpointRepository } from "./repositories/TouchpointRepository";
import { AttributionService } from "./services/AttributionService";

const touchpointRepository = new TouchpointRepository();
const attributionService = new AttributionService(
    touchpointRepository,
    ReferralContext.services.referral
);

export namespace AttributionContext {
    export const repositories = {
        touchpoint: touchpointRepository,
    };

    export const services = {
        attribution: attributionService,
    };
}
