import { contentId } from "@/context/common/config";
import type { NexusWalletSdkConfig } from "@frak-labs/nexus-sdk/core";

export const frakWalletSdkConfig: NexusWalletSdkConfig = {
    walletUrl: process.env.NEXUS_WALLET_URL as string,
    contentId,
    contentTitle: "Example News Paper",
};
