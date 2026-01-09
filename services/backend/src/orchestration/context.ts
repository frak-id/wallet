import { AttributionContext } from "../domain/attribution/context";
import { CampaignContext } from "../domain/campaign/context";
import { IdentityContext } from "../domain/identity/context";
import { ReferralContext } from "../domain/referral/context";
import { RewardsContext } from "../domain/rewards/context";
import { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";
import { PurchaseWebhookOrchestrator } from "./PurchaseWebhookOrchestrator";
import { RewardOrchestrator } from "./RewardOrchestrator";

const rewardOrchestrator = new RewardOrchestrator(
    RewardsContext.repositories.interactionLog,
    RewardsContext.repositories.assetLog,
    CampaignContext.services.ruleEngine,
    AttributionContext.services.attribution,
    IdentityContext.services.identityResolution,
    ReferralContext.services.referral
);

const purchaseLinkingOrchestrator = new PurchaseLinkingOrchestrator(
    IdentityContext.services.identityResolution,
    IdentityContext.repositories.identity,
    rewardOrchestrator
);

const purchaseWebhookOrchestrator = new PurchaseWebhookOrchestrator(
    purchaseLinkingOrchestrator
);

export namespace OrchestrationContext {
    export const orchestrators = {
        reward: rewardOrchestrator,
        purchaseLinking: purchaseLinkingOrchestrator,
        purchaseWebhook: purchaseWebhookOrchestrator,
    };
}
