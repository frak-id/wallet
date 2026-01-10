import { AttributionContext } from "../domain/attribution/context";
import { CampaignContext } from "../domain/campaign/context";
import { IdentityContext } from "../domain/identity/context";
import { MerchantContext } from "../domain/merchant/context";
import { PurchasesContext } from "../domain/purchases/context";
import { RewardsContext } from "../domain/rewards/context";
import { BatchRewardOrchestrator } from "./BatchRewardOrchestrator";
import { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";
import { PurchaseWebhookOrchestrator } from "./PurchaseWebhookOrchestrator";
import { SettlementOrchestrator } from "./SettlementOrchestrator";
import { WebhookResolverOrchestrator } from "./WebhookResolverOrchestrator";

const webhookResolverOrchestrator = new WebhookResolverOrchestrator(
    PurchasesContext.repositories.purchase,
    MerchantContext.repositories.merchant
);

const batchRewardOrchestrator = new BatchRewardOrchestrator(
    RewardsContext.repositories.interactionLog,
    RewardsContext.repositories.assetLog,
    IdentityContext.repositories.identity,
    CampaignContext.services.ruleEngine,
    AttributionContext.services.attribution,
    AttributionContext.services.referral
);

const purchaseLinkingOrchestrator = new PurchaseLinkingOrchestrator(
    PurchasesContext.repositories.purchase,
    IdentityContext.services.identityResolution,
    IdentityContext.repositories.identity,
    RewardsContext.repositories.interactionLog
);

const purchaseWebhookOrchestrator = new PurchaseWebhookOrchestrator(
    PurchasesContext.repositories.purchase,
    purchaseLinkingOrchestrator,
    RewardsContext.repositories.interactionLog
);

const settlementOrchestrator = new SettlementOrchestrator(
    RewardsContext.services.settlement,
    RewardsContext.repositories.assetLog,
    MerchantContext.repositories.merchant
);

export namespace OrchestrationContext {
    export const orchestrators = {
        batchReward: batchRewardOrchestrator,
        purchaseLinking: purchaseLinkingOrchestrator,
        purchaseWebhook: purchaseWebhookOrchestrator,
        settlement: settlementOrchestrator,
        webhookResolver: webhookResolverOrchestrator,
    };
}
