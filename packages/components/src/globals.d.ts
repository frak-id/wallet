import type {
    FinalActionType,
    LoginModalStepType,
    ModalRpcMetadata,
    NexusClient,
    NexusWalletSdkConfig,
    createIFrameNexusClient,
    createIframe,
} from "../core";
import type {
    ModalBuilder,
    modalBuilder,
    referralInteraction,
} from "../core/actions";

declare global {
    interface Window {
        NexusSDK: {
            createIframe: typeof createIframe;
            createIFrameNexusClient: typeof createIFrameNexusClient;
            modalBuilder: typeof modalBuilder;
            referralInteraction: typeof referralInteraction;
        };
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
