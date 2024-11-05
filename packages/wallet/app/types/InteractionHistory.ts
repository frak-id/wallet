import type { Address, Hex } from "viem";

type BaseInteraction = {
    productId: string;
    productName: string;
    timestamp: number; // timestamp in seconds
};

type OpenOrReadInteraction = BaseInteraction & {
    type: "OPEN_ARTICLE" | "READ_ARTICLE";
    data: {
        articleId: string;
    };
};
type PurchasesInteraction = BaseInteraction & {
    type: "PURCHASE_STARTED" | "PURCHASE_COMPLETED";
    data: {
        purchaseId: Hex;
    };
};
type ReferredInteraction = BaseInteraction & {
    type: "REFERRED";
    data: {
        referrer: Address;
    };
};
type CreateReferralLinkInteraction = BaseInteraction & {
    type: "CREATE_REFERRAL_LINK";
    data: null;
};
type WebShopOpenInteraction = BaseInteraction & {
    type: "WEBSHOP_OPENNED";
    data: null;
};

export type InteractionHistory =
    | OpenOrReadInteraction
    | ReferredInteraction
    | CreateReferralLinkInteraction
    | PurchasesInteraction
    | WebShopOpenInteraction;
