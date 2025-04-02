import type {
    DisplayEmbeddedWalletParamsType,
    FinalActionType,
    FrakClient,
    FrakWalletSdkConfig,
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
        };
    }
}
