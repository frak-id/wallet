import type { Hex } from "viem";

/**
 * Configuration for the Frak Wallet SDK
 */
export type FrakWalletSdkConfig = Readonly<{
    // The current url for the wallet sdk
    walletUrl: string;
    // The content id on which this sdk will be used
    contentId: Hex;
    // The content title
    contentTitle: string;
}>;
