import { AttributionContext } from "../domain/attribution/context";
import { CampaignContext } from "../domain/campaign/context";
import { IdentityContext } from "../domain/identity/context";
import { MerchantContext } from "../domain/merchant/context";
import { PurchasesContext } from "../domain/purchases/context";
import { RewardsContext } from "../domain/rewards/context";
import { pricingRepository } from "../infrastructure/pricing/PricingRepository";
import { BatchRewardOrchestrator } from "./BatchRewardOrchestrator";
import { CampaignStatsOrchestrator } from "./CampaignStatsOrchestrator";
import {
    AnonymousMergeOrchestrator,
    IdentityMergeService,
    IdentityOrchestrator,
    IdentityWeightService,
} from "./identity";
import { InteractionSubmissionOrchestrator } from "./interaction-submission";
import { MemberQueryOrchestrator } from "./MemberQueryOrchestrator";
import { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";
import { PurchaseWebhookOrchestrator } from "./PurchaseWebhookOrchestrator";
import { RewardExpirationOrchestrator } from "./RewardExpirationOrchestrator";
import { InteractionContextBuilder } from "./reward";
import { SettlementOrchestrator } from "./SettlementOrchestrator";
import { WebhookResolverOrchestrator } from "./WebhookResolverOrchestrator";

const webhookResolverOrchestrator = new WebhookResolverOrchestrator(
    PurchasesContext.repositories.purchase,
    MerchantContext.repositories.merchant
);

const identityWeightService = new IdentityWeightService(
    IdentityContext.repositories.identity
);

const identityMergeService = new IdentityMergeService();

const identityOrchestrator = new IdentityOrchestrator(
    IdentityContext.repositories.identity,
    identityWeightService,
    identityMergeService
);

const interactionContextBuilder = new InteractionContextBuilder(
    AttributionContext.services.attribution,
    IdentityContext.repositories.identity
);

const batchRewardOrchestrator = new BatchRewardOrchestrator(
    RewardsContext.repositories.interactionLog,
    RewardsContext.repositories.assetLog,
    CampaignContext.services.ruleEngine,
    AttributionContext.services.referral,
    identityOrchestrator,
    interactionContextBuilder,
    MerchantContext.repositories.merchant
);

const purchaseLinkingOrchestrator = new PurchaseLinkingOrchestrator(
    PurchasesContext.repositories.purchase,
    PurchasesContext.repositories.purchaseClaim,
    identityOrchestrator
);

const purchaseWebhookOrchestrator = new PurchaseWebhookOrchestrator(
    PurchasesContext.repositories.purchase,
    PurchasesContext.repositories.purchaseClaim,
    IdentityContext.repositories.identity,
    identityOrchestrator,
    RewardsContext.repositories.interactionLog
);

const settlementOrchestrator = new SettlementOrchestrator(
    RewardsContext.services.settlement,
    RewardsContext.repositories.assetLog,
    MerchantContext.repositories.merchant
);

const rewardExpirationOrchestrator = new RewardExpirationOrchestrator(
    RewardsContext.repositories.assetLog,
    CampaignContext.repositories.campaignRule
);

// Anonymous merge orchestrator needs identityOrchestrator to auto-create
// identity groups on merge token generation (same pattern as /track/arrival)
const memberQueryOrchestrator = new MemberQueryOrchestrator(pricingRepository);

const campaignStatsOrchestrator = new CampaignStatsOrchestrator();

const interactionSubmissionOrchestrator = new InteractionSubmissionOrchestrator(
    RewardsContext.repositories.interactionLog,
    AttributionContext.services.attribution
);

const anonymousMergeOrchestrator = new AnonymousMergeOrchestrator(
    IdentityContext.services.anonymousMerge,
    IdentityContext.repositories.identity,
    identityWeightService,
    identityMergeService,
    identityOrchestrator
);

export namespace OrchestrationContext {
    export const orchestrators = {
        interactionSubmission: interactionSubmissionOrchestrator,
        memberQuery: memberQueryOrchestrator,
        campaignStats: campaignStatsOrchestrator,
        anonymousMerge: anonymousMergeOrchestrator,
        batchReward: batchRewardOrchestrator,
        identity: identityOrchestrator,
        purchaseLinking: purchaseLinkingOrchestrator,
        purchaseWebhook: purchaseWebhookOrchestrator,
        rewardExpiration: rewardExpirationOrchestrator,
        settlement: settlementOrchestrator,
        webhookResolver: webhookResolverOrchestrator,
    };
}
