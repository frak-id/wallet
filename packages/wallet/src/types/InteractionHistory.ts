import type { Address } from "viem";

type BaseInteraction = {
    contentId: string;
    timestamp: number; // timestamp in seconds
};

type OpenOrReadInteraction = BaseInteraction & {
    type: "OPEN_ARTICLE" | "READ_ARTICLE";
    data: {
        articleId: string;
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

export type InteractionHistory =
    | OpenOrReadInteraction
    | ReferredInteraction
    | CreateReferralLinkInteraction;
