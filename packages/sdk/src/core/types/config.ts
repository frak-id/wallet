import type { Hex } from "viem";

/**
 * Configuration for the Nexus Wallet SDK
 */
export type NexusWalletSdkConfig = Readonly<{
    // The current url for the wallet sdk
    walletUrl: string;
    // The content id on which this sdk will be used
    contentId: Hex;
    // The content title
    contentTitle: string;
}>;
