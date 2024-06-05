/**
 * The Frak ecosystem addresses
 */
export const addresses = {
    // Registries
    contentRegistry: "0x5be7ae9f47dfe007CecA06b299e7CdAcD0A5C40e",
    referralRegistry: "0x0a1d4292bC42d39e02b98A6AF9d2E49F16DBED43",
    // Gating
    paywallToken: "0x9584A61F70cC4BEF5b8B5f588A1d35740f0C7ae2",
    paywall: "0x6a958DfCc9f00d00DE8Bf756D3d8A567368fdDD5",
    communityToken: "0xf98BA1b2fc7C55A01Efa6C8872Bcee85c6eC54e7",
    // Interactions
    contentInteractionManager: "0x34a6B1eAafEdf93A6B8658B7EA3035738929b159",
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
    // Kernel stuff
    accountLogic: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
    factory: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
} as const;
