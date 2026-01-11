import { AttributionContext } from "../domain/attribution/context";
import { CampaignContext } from "../domain/campaign/context";
import { IdentityContext } from "../domain/identity/context";
import { MerchantContext } from "../domain/merchant/context";
import { PurchasesContext } from "../domain/purchases/context";
import { RewardsContext } from "../domain/rewards/context";
import { rewardsHubRepository } from "../infrastructure/blockchain/contracts/RewardsHubRepository";
import { BatchRewardOrchestrator } from "./BatchRewardOrchestrator";
import { IdentityOrchestrator } from "./identity";
import { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";
import { PurchaseWebhookOrchestrator } from "./PurchaseWebhookOrchestrator";
import { InteractionContextBuilder } from "./reward";
import { SettlementOrchestrator } from "./SettlementOrchestrator";
import { WebhookResolverOrchestrator } from "./WebhookResolverOrchestrator";

const webhookResolverOrchestrator = new WebhookResolverOrchestrator(
    PurchasesContext.repositories.purchase,
    MerchantContext.repositories.merchant
);

const identityOrchestrator = new IdentityOrchestrator(
    IdentityContext.repositories.identity,
    rewardsHubRepository
);

const interactionContextBuilder = new InteractionContextBuilder(
    AttributionContext.services.attribution,
    identityOrchestrator
);

const batchRewardOrchestrator = new BatchRewardOrchestrator(
    RewardsContext.repositories.interactionLog,
    RewardsContext.repositories.assetLog,
    CampaignContext.services.ruleEngine,
    AttributionContext.services.referral,
    identityOrchestrator,
    interactionContextBuilder
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

export namespace OrchestrationContext {
    export const orchestrators = {
        batchReward: batchRewardOrchestrator,
        identity: identityOrchestrator,
        purchaseLinking: purchaseLinkingOrchestrator,
        purchaseWebhook: purchaseWebhookOrchestrator,
        settlement: settlementOrchestrator,
        webhookResolver: webhookResolverOrchestrator,
    };
}
