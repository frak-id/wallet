/**
 * The final keys for each interaction types (e.g. `openArticle`) -> interaction type
 * @inline
 */
export type InteractionTypesKey = {
    [K in keyof typeof interactionTypes]: keyof (typeof interactionTypes)[K];
}[keyof typeof interactionTypes];

/**
 * The keys for each interaction types (e.g. `press.openArticle`) -> category_type.interaction_type
 * @inline
 */
export type FullInteractionTypesKey = {
    [Category in keyof typeof interactionTypes]: `${Category & string}.${keyof (typeof interactionTypes)[Category] & string}`;
}[keyof typeof interactionTypes];

/**
 * Each interactions types according to the product types
 */
export const interactionTypes = {
    press: {
        openArticle: "0xc0a24ffb",
        readArticle: "0xd5bd0fbe",
    },
    dapp: {
        proofVerifiableStorageUpdate: "0x2ab2aeef",
        callableVerifiableStorageUpdate: "0xa07da986",
    },
    webshop: {
        open: "0xb311798f",
    },
    referral: {
        referred: "0x010cc3b9",
        createLink: "0xb2c0f17c",
    },
    purchase: {
        started: "0xd87e90c3",
        completed: "0x8403aeb4",
    },
    retail: {
        customerMeeting: "0x74489004",
    },
} as const;
