import { AttributionContext } from "../domain/attribution/context";
import { CampaignContext } from "../domain/campaign/context";
import { IdentityContext } from "../domain/identity/context";
import { MerchantContext } from "../domain/merchant/context";
import { PurchasesContext } from "../domain/purchases/context";
import { RewardsContext } from "../domain/rewards/context";
import { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";
import { PurchaseWebhookOrchestrator } from "./PurchaseWebhookOrchestrator";
import { RewardOrchestrator } from "./RewardOrchestrator";
import { SettlementOrchestrator } from "./SettlementOrchestrator";
import { WebhookResolverOrchestrator } from "./WebhookResolverOrchestrator";

const webhookResolverOrchestrator = new WebhookResolverOrchestrator(
    PurchasesContext.repositories.purchase,
    MerchantContext.repositories.merchant
);

const rewardOrchestrator = new RewardOrchestrator(
    RewardsContext.repositories.interactionLog,
    RewardsContext.repositories.assetLog,
    CampaignContext.services.ruleEngine,
    AttributionContext.services.attribution,
    IdentityContext.services.identityResolution,
    AttributionContext.services.referral
);

const purchaseLinkingOrchestrator = new PurchaseLinkingOrchestrator(
    PurchasesContext.repositories.purchase,
    IdentityContext.services.identityResolution,
    IdentityContext.repositories.identity,
    rewardOrchestrator
);

const purchaseWebhookOrchestrator = new PurchaseWebhookOrchestrator(
    PurchasesContext.repositories.purchase,
    purchaseLinkingOrchestrator
);

const settlementOrchestrator = new SettlementOrchestrator(
    RewardsContext.services.settlement,
    RewardsContext.repositories.assetLog,
    MerchantContext.repositories.merchant
);

export namespace OrchestrationContext {
    export const orchestrators = {
        reward: rewardOrchestrator,
        purchaseLinking: purchaseLinkingOrchestrator,
        purchaseWebhook: purchaseWebhookOrchestrator,
        settlement: settlementOrchestrator,
        webhookResolver: webhookResolverOrchestrator,
    };
}
