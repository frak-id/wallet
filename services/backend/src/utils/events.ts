export type FrakEvents = {
    newInteraction: [{ type: InteractionEventType }];
    newPendingRewards: [{ count: number }];
};

type InteractionEventType =
    | "referral_arrival"
    | "create_referral_link"
    | "purchase"
    | "wallet_connect"
    | "identity_merge";
