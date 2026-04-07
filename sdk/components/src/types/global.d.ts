import type {
    DisplayEmbeddedWalletParamsType,
    FrakClient,
    FrakWalletSdkConfig,
} from "@frak-labs/core-sdk";

declare global {
    interface Window {
        frakSetupInProgress?: boolean;
        // The Frak Setup config
        FrakSetup: {
            // Inner built client
            client?: FrakClient;
            // User provided config for the frak wallet sdk
            config?: FrakWalletSdkConfig;
            // User provided config for the modal wallet
            modalWalletConfig?: DisplayEmbeddedWalletParamsType;
            // Export the core sdk
            core?: typeof import("@frak-labs/core-sdk/bundle");
        };
    }
}
