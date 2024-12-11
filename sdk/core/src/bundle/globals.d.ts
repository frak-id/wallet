import type {
    FinalActionType,
    LoginModalStepType,
    ModalRpcMetadata,
    NexusClient,
    NexusWalletSdkConfig,
} from "../index.ts";

declare global {
    interface Window {
        FrakSetup: {
            client?: NexusClient;
            config?: NexusWalletSdkConfig;
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
