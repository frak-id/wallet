import type {
    DisplayEmbededWalletParamsType,
    FinalActionType,
    FrakWalletSdkConfig,
    LoginModalStepType,
    ModalRpcMetadata,
} from "@frak-labs/core-sdk";

declare global {
    interface Window {
        FrakSetup: {
            config?: FrakWalletSdkConfig;
            modalConfig?: {
                metadata: ModalRpcMetadata;
                login: LoginModalStepType["params"];
            };
            modalShareConfig?: Extract<
                FinalActionType,
                { key: "sharing" }
            >["options"];
            modalWalletConfig?: DisplayEmbededWalletParamsType;
        };
    }
}
