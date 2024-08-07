import type { NexusWalletSdkConfig } from "@frak-labs/nexus-sdk/core";
import { isRunningLocally } from "@frak-labs/shared/context/utils/env";

export const frakWalletSdkConfig: Omit<NexusWalletSdkConfig, "domain"> = {
    walletUrl: process.env.NEXUS_WALLET_URL as string,
    metadata: {
        name: "Dashboard",
        css: isRunningLocally
            ? "http://localhost:3001/css/nexus-modals.css"
            : "https://business-dev.frak.id/css/nexus-modals.css",
    },
};
