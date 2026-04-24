import { AttributionContext } from "../domain/attribution/context";
import { CampaignContext } from "../domain/campaign/context";
import { CampaignBankContext } from "../domain/campaign-bank/context";
import { IdentityContext } from "../domain/identity/context";
import { MerchantContext } from "../domain/merchant/context";
import { NotificationContext } from "../domain/notifications/context";
import { PurchasesContext } from "../domain/purchases/context";
import { ReferralCodeContext } from "../domain/referral-code/context";
import { RewardsContext } from "../domain/rewards/context";
import { WalletContext } from "../domain/wallet/context";
import { pricingRepository } from "../infrastructure/pricing/PricingRepository";
import { BatchRewardOrchestrator } from "./BatchRewardOrchestrator";
import { CampaignStatsOrchestrator } from "./CampaignStatsOrchestrator";
import { ExplorerOrchestrator } from "./ExplorerOrchestrator";
import {
    AnonymousMergeOrchestrator,
    IdentityMergeService,
    IdentityOrchestrator,
    IdentityWeightService,
} from "./identity";
import { InteractionSubmissionOrchestrator } from "./interaction-submission";
import { MemberQueryOrchestrator } from "./MemberQueryOrchestrator";
import { NotificationOrchestrator } from "./NotificationOrchestrator";
import { PurchaseInteractionCreator } from "./PurchaseInteractionCreator";
import { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";
import { PurchaseWebhookOrchestrator } from "./PurchaseWebhookOrchestrator";
import { RewardExpirationOrchestrator } from "./RewardExpirationOrchestrator";
import { RewardHistoryOrchestrator } from "./RewardHistoryOrchestrator";
import { ReferralCodeRedemptionOrchestrator } from "./referral-code";
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
    IdentityContext.repositories.identity,
    AttributionContext.repositories.referralLink
);

const notificationOrchestrator = new NotificationOrchestrator(
    NotificationContext.services.notifications,
    MerchantContext.repositories.merchant
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

const purchaseInteractionCreator = new PurchaseInteractionCreator(
    RewardsContext.repositories.interactionLog
);

const purchaseLinkingOrchestrator = new PurchaseLinkingOrchestrator(
    PurchasesContext.repositories.purchase,
    PurchasesContext.repositories.purchaseClaim,
    identityOrchestrator,
    purchaseInteractionCreator
);

const purchaseWebhookOrchestrator = new PurchaseWebhookOrchestrator(
    PurchasesContext.repositories.purchase,
    PurchasesContext.repositories.purchaseClaim,
    purchaseInteractionCreator,
    identityOrchestrator
);

const settlementOrchestrator = new SettlementOrchestrator(
    RewardsContext.services.settlement,
    RewardsContext.repositories.assetLog,
    MerchantContext.repositories.merchant,
    IdentityContext.repositories.identity,
    RewardsContext.repositories.interactionLog,
    CampaignBankContext.repositories.campaignBank
);

const rewardExpirationOrchestrator = new RewardExpirationOrchestrator(
    RewardsContext.repositories.assetLog,
    CampaignContext.repositories.campaignRule
);

const rewardHistoryOrchestrator = new RewardHistoryOrchestrator(
    RewardsContext.repositories.assetLog,
    IdentityContext.repositories.identity,
    PurchasesContext.repositories.purchase,
    WalletContext.repositories.balances,
    pricingRepository,
    RewardsContext.services.rewardHistory,
    AttributionContext.repositories.touchpoint,
    RewardsContext.repositories.interactionLog
);

// Anonymous merge orchestrator needs identityOrchestrator to auto-create
// identity groups on merge token generation (same pattern as /track/arrival)
const memberQueryOrchestrator = new MemberQueryOrchestrator(pricingRepository);

const campaignStatsOrchestrator = new CampaignStatsOrchestrator();

const explorerOrchestrator = new ExplorerOrchestrator();

const interactionSubmissionOrchestrator = new InteractionSubmissionOrchestrator(
    RewardsContext.repositories.interactionLog,
    AttributionContext.services.attribution
);

const anonymousMergeOrchestrator = new AnonymousMergeOrchestrator(
    IdentityContext.services.anonymousMerge,
    IdentityContext.repositories.identity,
    identityOrchestrator
);

const referralCodeRedemptionOrchestrator =
    new ReferralCodeRedemptionOrchestrator(
        ReferralCodeContext.services.referralCode,
        AttributionContext.repositories.referralLink
    );

export namespace OrchestrationContext {
    export const orchestrators = {
        explorer: explorerOrchestrator,
        interactionSubmission: interactionSubmissionOrchestrator,
        memberQuery: memberQueryOrchestrator,
        campaignStats: campaignStatsOrchestrator,
        anonymousMerge: anonymousMergeOrchestrator,
        batchReward: batchRewardOrchestrator,
        identity: identityOrchestrator,
        notification: notificationOrchestrator,
        purchaseLinking: purchaseLinkingOrchestrator,
        purchaseWebhook: purchaseWebhookOrchestrator,
        rewardExpiration: rewardExpirationOrchestrator,
        rewardHistory: rewardHistoryOrchestrator,
        settlement: settlementOrchestrator,
        webhookResolver: webhookResolverOrchestrator,
        referralCodeRedemption: referralCodeRedemptionOrchestrator,
    };
}
