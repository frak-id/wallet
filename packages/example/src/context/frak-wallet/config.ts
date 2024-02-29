import type { FrakWalletSdkConfig } from "@frak-wallet/sdk/core";

export const frakWalletSdkConfig: FrakWalletSdkConfig = {
    walletUrl: process.env.FRAK_WALLET_URL as string,
    contentId: "0xDD",
    contentTitle: "Example News Paper",
};
