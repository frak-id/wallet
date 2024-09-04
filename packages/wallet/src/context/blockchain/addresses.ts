/**
 * The kernel related addresses
 */
export const kernelAddresses = {
    // WebAuthN
    multiWebAuthnRecovery: "0x8b29229515D3e5b829D59617A791b5B3a2c32ff1",
    multiWebAuthnValidator: "0xF05f18D9312f10d1d417c45040B8497899f66A5E",
    // Interactions
    interactionDelegatorValidator: "0xb33cc9Aea3f6e1125179Ec0A1D9783eD3717d04C",
    interactionDelegatorAction: "0xaAF9c01fe6193d6226003B233A68f6EDD807bAb0",
    // Kernel stuff
    ecdsaValidator: "0xd9AB5096a832b9ce79914329DAEE236f8Eea0390",
    accountLogic: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
    factory: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
} as const;
