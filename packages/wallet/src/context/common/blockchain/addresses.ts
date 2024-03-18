import type { Address } from "viem";

/**
 * The frak smart contract addresses on amoy
 */
export const addresses = {
    frakToken: "0x183a08d221163335fC20B07E53236403CE9dc03d",
    multiVestingWallet: "0x4Be1153c6dc18BbE75b8F8E1C9CA52cbbEE38215",
    vestingWalletFactory: "0x96a0B8dA8D2c38352e2A910f6E8124dAA4a44a8d",
    fraktionTokens: "0xa6713941ABA860DA9fd6CCA53E5b5583E82Af475",
    referralPool: "0x975dfE2EAa974933e772D25A61640DB1088AAD9e",
    contentPool: "0x0DF67c0F092cC595104B4586Ffd2F30790E31f8f",
    rewarder: "0x23BAC39b7849E029F77d981485B6259172E3558e",
    minter: "0x726BA97e5e4a8Fb630cdBf12383Bd9905CEDA074",
    frakTreasuryWallet: "0xC1B4bFFEC8ea8E0BE9D923358652A32911c4d2Ce",
    swapPool: "0x78006cCa3dC37ED26139c916B97Ef997323D58e0",
    walletMigrator: "0xef7336D5be2F9da8a149e61a926b0f2B85373e6e",
} as const;

/**
 * The address where the paywall is deployed
 */
export const paywallAddress: Address =
    "0x438fb6eEDBa3C300F5a1f636F33cAf20715b46f5";
