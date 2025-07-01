import type {
    DisplayEmbeddedWalletParamsType,
    FinalActionType,
    FrakClient,
    FrakWalletSdkConfig,
    I18nConfig,
    LoginModalStepType,
    ModalBuilder,
    ModalRpcMetadata,
} from "@frak-labs/core-sdk";

declare global {
    interface Window {
        frakSetupInProgress?: boolean;
        modalBuilderSteps?: ModalBuilder;
        // The Frak Setup config
        FrakSetup: {
            // Inner built client
            client?: FrakClient;
            // User provided config for the frak wallet sdk
            config?: FrakWalletSdkConfig;
            // User provided config for the modal
            modalConfig?: {
                metadata?: ModalRpcMetadata;
                login?: LoginModalStepType["params"];
            };
            // User provided config for the modal share
            modalShareConfig?: Extract<
                FinalActionType,
                { key: "sharing" }
            >["options"];
            // User provided config for the modal wallet
            modalWalletConfig?: DisplayEmbeddedWalletParamsType;
            // Campaign-specific i18n configurations
            campaignI18n?: Record<string, I18nConfig>;
            // Export the core sdk
            core?: typeof import("@frak-labs/core-sdk/bundle");
        };
    }
}
