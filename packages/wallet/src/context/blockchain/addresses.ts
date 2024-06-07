/**
 * The Frak ecosystem addresses
 */
export const addresses = {
    // Registries
    contentRegistry: "0xc02209e937dB50C80AA1A280f9172163D8aC6a38",
    referralRegistry: "0x0a1d4292bC42d39e02b98A6AF9d2E49F16DBED43",
    // Gating
    paywallToken: "0x9584A61F70cC4BEF5b8B5f588A1d35740f0C7ae2",
    paywall: "0x99F44C46fb00b94f5Cff57cbbF3d57303469E884",
    communityToken: "0x932145A69BaF498D7F87D06db2E6c7963BF86E85",
    // Interactions
    contentInteractionManager: "0x71a54b7Edb803b0FB6c7A930794BcA13587Af21b",
    // Old, todo: to be delete
    referralToken: "0x1Eca7AA9ABF2e53E773B4523B6Dc103002d22e7D",
    nexusDiscoverCampaign: "0x8a37d1B3a17559F2BC4e6613834b1F13d0A623aC",
} as const;

/**
 * The kernel related addresses
 */
export const kernelAddresses = {
    // Recovery
    multiWebAuthnRecovery: "0x67236B8AAF4B32d2D3269e088B1d43aef7736ab9",
    // Validators
    multiWebAuthnValidator: "0xD546c4Ba2e8e5e5c961C36e6Db0460Be03425808",
    ecdsaValidator: "0xd9AB5096a832b9ce79914329DAEE236f8Eea0390",
    // Interactions
    interactionSessionValidator: "0x4794D967Bcd1A07EBd1c6dC4A44210Bb27ca7f50",
    interactionAction: "0x2E57E39eDfb39956548333AB3Cc708f5339195D6",
    // Kernel stuff
    accountLogic: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
    factory: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
} as const;
