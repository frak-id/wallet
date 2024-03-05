import type { NexusWalletSdkConfig } from "@frak-labs/nexus-sdk/core";

export const frakWalletSdkConfig: NexusWalletSdkConfig = {
    walletUrl: process.env.FRAK_WALLET_URL as string,
    contentId: "0xDD",
    contentTitle: "Example News Paper",
};
