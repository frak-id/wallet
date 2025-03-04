import type {
    DisplayEmbededWalletParamsType,
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
        FrakSetup: {
            client?: FrakClient;
            config?: FrakWalletSdkConfig;
            modalConfig?: {
                metadata?: ModalRpcMetadata;
                login?: LoginModalStepType["params"];
            };
            modalShareConfig?: Extract<
                FinalActionType,
                { key: "sharing" }
            >["options"];
            modalWalletConfig?: DisplayEmbededWalletParamsType;
        };
    }
}
