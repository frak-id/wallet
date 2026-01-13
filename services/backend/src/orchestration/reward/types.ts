import type { Address } from "viem";
import type {
    CampaignTrigger,
    PurchaseContext,
    RuleContext,
} from "../../domain/campaign";

export type InteractionContextResult = {
    trigger: CampaignTrigger;
    context: Omit<RuleContext, "time">;
};

export type TypeSpecificContextResult = {
    trigger: CampaignTrigger;
    typeContext: { purchase?: PurchaseContext };
    walletAddressOverride?: Address | null;
};
