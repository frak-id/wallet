/**
 * The POC smart contract addresses on testnets
 */
export const addresses = {
    contentRegistry: "0xD4BCd67b1C62aB27FC04FBd49f3142413aBFC753",
    paywallToken: "0x9584A61F70cC4BEF5b8B5f588A1d35740f0C7ae2",
    paywall: "0x9218521020EF26924B77188f4ddE0d0f7C405f21",
    communityToken: "0xD2849EB12DAcACB4940063007CCbC325cBBb290d",
} as const;

/**
 * The kernel related addresses
 */
export const kernelAddresses = {
    // Validators
    multiWebAuthnValidator: "0xD546c4Ba2e8e5e5c961C36e6Db0460Be03425808",
    ecdsaValidator: "0xd9AB5096a832b9ce79914329DAEE236f8Eea0390",
    // Kernel stuff
    accountLogic: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
    factory: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
} as const;
