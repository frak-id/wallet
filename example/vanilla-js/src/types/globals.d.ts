import type {
    displayModal,
    referralInteraction,
    watchWalletStatus,
} from "@frak-labs/nexus-sdk/actions";
import type {
    NexusClient,
    NexusWalletSdkConfig,
    createIFrameNexusClient,
    createIframe,
} from "@frak-labs/nexus-sdk/core";

declare global {
    interface Window {
        NexusSDK: {
            createIframe: typeof createIframe;
            createIFrameNexusClient: typeof createIFrameNexusClient;
            displayModal: typeof displayModal;
            referralInteraction: typeof referralInteraction;
            watchWalletStatus: typeof watchWalletStatus;
        };
        FrakSetup: {
            frakConfig: NexusWalletSdkConfig;
            frakClient: NexusClient | null;
            modalShare: () => void;
        };
    }
}
