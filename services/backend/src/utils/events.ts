export type FrakEvents = {
    newInteraction: [{ type: InteractionEventType }];
    newPendingRewards: [{ count: number }];
};

export type InteractionEventType =
    | "referral_arrival"
    | "purchase"
    | "wallet_connect"
    | "identity_merge";
