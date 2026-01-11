import type { Address } from "viem";
import type {
    CampaignTrigger,
    PurchaseContext,
    RuleContext,
} from "../../domain/campaign";

export type AttributionForContext = {
    source: "referral_link" | "organic" | "paid_ad" | "direct" | null;
    touchpointId: string | null;
    referrerWallet: Address | null;
    referrerIdentityGroupId: string | null;
};

export type UserForContext = {
    identityGroupId: string;
    walletAddress: Address | null;
};

export type InteractionContextResult = {
    trigger: CampaignTrigger;
    context: Omit<RuleContext, "time">;
};

export type TypeSpecificContextResult = {
    trigger: CampaignTrigger;
    typeContext: { purchase?: PurchaseContext };
    walletAddressOverride?: Address | null;
};
