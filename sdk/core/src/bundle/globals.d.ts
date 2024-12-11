import type {
    FinalActionType,
    FrakClient,
    FrakWalletSdkConfig,
    LoginModalStepType,
    ModalRpcMetadata,
} from "../index.ts";

declare global {
    interface Window {
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
        };
    }
}
