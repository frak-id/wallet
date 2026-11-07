import { isRunningInProd } from "../utils/env";

/**
 * The Frak ecosystem addresses
 */
export const addresses = {
    // Frak v2
    rewarderHub: "0x2832c6D07621ae8335AEBa17a5A3747f032ff168",
    campaignBankFactory: "0x9aD5b5fe2b484dBa9c019660ef085FFe8A6908E1",
    // Kernel
    p256Wrapper: "0x00e4005A00007384000000B0a8A0F300DD9fCAFA",
    webAuthNRecoveryAction: "0x000000000093c960bC9F9Dc93509E394a96c7FD9",
    webAuthNValidator: "0x0000000000Fb9604350a25E826B050D859FE7b77",
} as const;

/**
 * The kernel related addresses
 */
export const kernelAddresses = {
    // Kernel stuff
    ecdsaValidator: "0xd9AB5096a832b9ce79914329DAEE236f8Eea0390",
    accountLogic: "0xd3082872F8B06073A021b4602e022d5A070d7cfC",
    factory: "0x5de4839a76cf55d0c90e2061ef4386d962E15ae3",
} as const;

/**
 * Stablecoin addresses for different environments
 */
export const stablecoins = {
    // Production addresses (Arbitrum mainnet)
    prod: {
        eure: "0x0c06cCF38114ddfc35e07427B9424adcca9F44F8",
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },
    // Testnet addresses (Arbitrum Sepolia)
    testnet: {
        eure: "0xFdEed5cE7E281B4e0F163B70eBe2Cf0B10803b7B",
        usdc: "0x43838DCb58a61325eC5F31FD70aB8cd3540733d1",
    },
} as const;

/**
 * Get the current stablecoin addresses based on environment
 */
export const currentStablecoins = isRunningInProd
    ? stablecoins.prod
    : stablecoins.testnet;

export type Stablecoin = keyof typeof currentStablecoins;

/**
 * Known stablecoins as a list of address
 */
export const currentStablecoinsList = Object.values(currentStablecoins);
