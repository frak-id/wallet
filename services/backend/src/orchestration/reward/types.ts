import type {
    CampaignTrigger,
    CustomInteractionContext,
    PurchaseContext,
    RuleContext,
} from "../../domain/campaign";

export type { CustomInteractionContext as CustomContext };

export type InteractionContextResult = {
    trigger: CampaignTrigger;
    context: Omit<RuleContext, "time">;
    referralLinkId: string | null;
    campaignRuleIds?: readonly string[];
};

export type TypeSpecificContextResult = {
    trigger: CampaignTrigger;
    typeContext: {
        purchase?: PurchaseContext;
        custom?: CustomInteractionContext;
    };
    /** Only these campaigns may reward the interaction. */
    campaignRuleIds?: readonly string[];
};
