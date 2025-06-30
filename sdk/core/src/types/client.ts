import type { OpenPanel } from "@openpanel/web";
import type { FrakWalletSdkConfig } from "./config";
import type { IFrameTransport } from "./transport";

/**
 * Representing a Frak client, used to interact with the Frak Wallet
 */
export type FrakClient = {
    config: FrakWalletSdkConfig;
    debugInfo: {
        formatDebugInfo: (error: Error | unknown | string) => string;
    };
    openPanel?: OpenPanel;
} & IFrameTransport;
