import type { FrakClient, FrakWalletSdkConfig } from "@frak-labs/core-sdk";

/**
 * Legacy shape of `window.FrakSetup.modalWalletConfig`.
 *
 * This used to be the full `DisplayEmbeddedWalletParamsType` config for the
 * embedded wallet drawer. That surface is gone, but integrations still in the
 * wild (notably the Magento module) keep injecting the object to pick the side
 * `<frak-button-wallet>` anchors to, so the position hint is still honoured.
 *
 * @deprecated Configure the button position via the placement config instead.
 */
type LegacyModalWalletConfig = {
    metadata?: {
        position?: "left" | "right";
    };
};

declare global {
    interface Window {
        // The Frak Setup config
        FrakSetup: {
            // Inner built client
            client?: FrakClient;
            // User provided config for the frak wallet sdk
            config?: FrakWalletSdkConfig;
            /**
             * Legacy embedded-wallet config; only the button position is
             * still read.
             * @deprecated
             */
            modalWalletConfig?: LegacyModalWalletConfig;
            // Export the core sdk
            core?: typeof import("@frak-labs/core-sdk/bundle");
        };
    }
}
