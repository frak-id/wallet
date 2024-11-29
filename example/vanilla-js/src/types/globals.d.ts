import type {
    FinalActionType,
    LoginModalStepType,
    ModalRpcMetadata,
    NexusWalletSdkConfig,
} from "@frak-labs/nexus-sdk/core";

declare global {
    interface Window {
        FrakSetup: {
            config?: NexusWalletSdkConfig;
            modalConfig?: {
                metadata: ModalRpcMetadata;
                login: LoginModalStepType["params"];
            };
            modalShareConfig: Extract<
                FinalActionType,
                { key: "sharing" }
            >["options"];
        };
    }
}
