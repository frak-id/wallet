import type { Address, Hex } from "viem";

/**
 * Article interaction data
 */
export type ArticleInteraction = {
    type: "OPEN_ARTICLE" | "READ_ARTICLE";
    data: {
        articleId: string;
    };
};

/**
 * Referral interaction data
 */
export type ReferredInteraction = {
    type: "REFERRED";
    data: {
        referrer: Address;
    };
};

/**
 * Simple interaction with no additional data
 */
export type SimpleInteraction = {
    type: "CREATE_REFERRAL_LINK" | "WEBSHOP_OPENNED";
    data: null;
};

/**
 * Purchase interaction data
 */
export type PurchaseInteraction = {
    type: "PURCHASE_STARTED" | "PURCHASE_COMPLETED";
    data: {
        purchaseId: Hex;
    };
};

/**
 * Customer meeting interaction data
 */
export type CustomerMeetingInteraction = {
    type: "CUSTOMER_MEETING";
    data: {
        agencyId: string;
    };
};

/**
 * Union type for all interaction types
 */
export type GetInteractionItemDto = {
    timestamp: string;
    productId: string;
    productName: string;
} & (
    | ArticleInteraction
    | ReferredInteraction
    | SimpleInteraction
    | PurchaseInteraction
    | CustomerMeetingInteraction
);

/**
 * Response type for the interactions endpoint
 */
export type GetInteractionsResponseDto = GetInteractionItemDto[];
