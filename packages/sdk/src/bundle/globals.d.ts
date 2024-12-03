import type {
    FinalActionType,
    LoginModalStepType,
    ModalRpcMetadata,
    NexusClient,
    NexusWalletSdkConfig,
} from "../core";
import type { ModalBuilder } from "../core/actions";

declare global {
    interface Window {
        FrakSetup: {
            client?: NexusClient;
            config?: NexusWalletSdkConfig;
            modalConfig?: {
                metadata: ModalRpcMetadata;
                login: LoginModalStepType["params"];
            };
            modalShareConfig: Extract<
                FinalActionType,
                { key: "sharing" }
            >["options"];
            modalBuilderSteps: ModalBuilder;
        };
    }
}
