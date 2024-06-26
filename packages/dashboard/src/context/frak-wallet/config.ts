import type { NexusWalletSdkConfig } from "@frak-labs/nexus-sdk/core";

export const frakWalletSdkConfig: Omit<NexusWalletSdkConfig, "domain"> = {
    walletUrl: process.env.NEXUS_WALLET_URL as string,
    metadata: {
        name: "Dashboard",
    },
};
