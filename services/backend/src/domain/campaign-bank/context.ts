import { MerchantContext } from "../merchant";
import { CampaignBankRepository } from "./repositories/CampaignBankRepository";
import { CampaignBankService } from "./services/CampaignBankService";

const campaignBankRepository = new CampaignBankRepository();

const campaignBankService = new CampaignBankService(
    campaignBankRepository,
    MerchantContext.repositories.merchant
);

export namespace CampaignBankContext {
    export const repositories = {
        campaignBank: campaignBankRepository,
    };

    export const services = {
        campaignBank: campaignBankService,
    };
}
