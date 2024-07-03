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
    interactionAction: "0xbDa850Ec1CD0F15275746fb185F98eE03F8Cdc4d",
    // Kernel stuff
    accountLogic: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
    factory: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
} as const;
