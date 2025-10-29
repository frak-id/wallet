import { isRunningLocally } from "@frak-labs/app-essentials";
import type { FrakWalletSdkConfig } from "@frak-labs/core-sdk";

export const frakWalletSdkConfig: Omit<FrakWalletSdkConfig, "domain"> = {
    walletUrl: process.env.FRAK_WALLET_URL as string,
    metadata: {
        name: "Dashboard",
    },
    customizations: {
        css: isRunningLocally
            ? "https://localhost:3001/css/nexus-modals.css"
            : "https://business-dev.frak.id/css/nexus-modals.css",
    },
};
