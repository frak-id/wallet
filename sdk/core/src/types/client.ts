import type { FrakWalletSdkConfig } from "./config";
import type { IFrameTransport } from "./transport";

/**
 * Representing a Frak client
 */
export type FrakClient = {
    config: FrakWalletSdkConfig;
} & IFrameTransport;
