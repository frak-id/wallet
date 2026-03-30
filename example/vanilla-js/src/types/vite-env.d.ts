/// <reference types="vite/client" />

import type { FrakClient, FrakWalletSdkConfig } from "@frak-labs/core-sdk";

declare global {
    interface Window {
        FrakSetup: {
            client?: FrakClient;
            config?: FrakWalletSdkConfig;
            core?: typeof import("@frak-labs/core-sdk/bundle");
            modalWalletConfig?: unknown;
        };
        frakSetupInProgress?: boolean;
    }
}
