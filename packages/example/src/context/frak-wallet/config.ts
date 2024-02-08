import type { FrakWalletSdkConfig } from "@frak-wallet/sdk/src/types";

export const frakWalletSdkConfig: FrakWalletSdkConfig = {
    walletUrl: process.env.FRAK_WALLET_URL as string,
    contentId: "0x1234567890",
    contentTitle: "Example News Paper",
};
