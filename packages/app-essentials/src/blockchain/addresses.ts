import { isRunningInProd } from "../utils/env";

/**
 * The Frak ecosystem addresses
 */
export const addresses = {
    // nexus
    campaignBankFactory: "0x00000000003604CF2d09f4Aa3B878843A765015d",
    campaignFactory: "0xfE0D3FD4ed50CE828b8192fc5D547Ee609Abe1eC",
    facetFactory: "0x5Dcb1bB90Fc25ceFe9815bbd0c710F0496Fe946B",
    mUSDToken: "0x43838DCb58a61325eC5F31FD70aB8cd3540733d1",
    productAdministratorRegistry: "0x0000000000000823EaD12075a50A2a6520966e5c",
    productInteractionManager: "0x0000000000009720dc2B0D893f7Ec2a878d21AeC",
    productRegistry: "0x9100000000290000D9a49572110030ba00E0F40b",
    purchaseOracle: "0x0000EC17000000e783CA00Ee06890000114C100d",
    referralRegistry: "0x5439e7b27500f7000A6DCD00006D000082510000",
    // Kernel
    interactionDelegator: "0x0000000000915Bae6248227914666Afd11Ad706e",
    interactionDelegatorAction: "0x00000000001BF7FE0EEBf7c66E1e624D52a12FAD",
    interactionDelegatorValidator: "0x00000000002f84e026BbA7983F3c189D0C6dc8Fa",
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
 * The usdc address on arbitrum
 */
export const usdcArbitrumAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

/**
 * Stablecoin addresses for different environments
 */
export const stablecoins = {
    // Production addresses (Arbitrum mainnet)
    prod: {
        eure: "0x0c06cCF38114ddfc35e07427B9424adcca9F44F8",
        gbpe: "0x2D80dBf04D0802abD7A342DaFA5d7cB42bfbb52f",
        usde: "0x0Fc041a4B6a3F634445804daAFD03f202337C125",
    },
    // Testnet addresses (Arbitrum Sepolia)
    testnet: {
        eure: "0xFdEed5cE7E281B4e0F163B70eBe2Cf0B10803b7B",
        gbpe: "0x73734dfe9902C4bD411A9577905D9afC15B1d93B",
        usde: "0xF11444Ee82a391315B06916667796Aa3d33d1A78",
    },
} as const;

/**
 * Get the current stablecoin addresses based on environment
 */
export const currentStablecoins = isRunningInProd
    ? stablecoins.prod
    : stablecoins.testnet;
