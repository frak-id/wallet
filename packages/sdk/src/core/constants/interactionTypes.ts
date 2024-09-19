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
    webshop: {},
    referral: {
        referred: "0x010cc3b9",
        createLink: "0xb2c0f17c",
    },
    purchase: {
        started: "0xd87e90c3",
        completed: "0x8403aeb4",
    },
} as const;
