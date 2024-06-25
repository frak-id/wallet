import type { NexusWalletSdkConfig } from "@frak-labs/nexus-sdk/core";

export const frakWalletSdkConfig: NexusWalletSdkConfig = {
    walletUrl: process.env.NEXUS_WALLET_URL as string,
    metadata: {
        name: "Dashboard",
    },
};
