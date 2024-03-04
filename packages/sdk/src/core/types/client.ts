import type { NexusWalletSdkConfig } from "./config";
import type { IFrameTransport } from "./transport";

/**
 * Representing a Nexus client
 */
export type NexusClient = {
    config: NexusWalletSdkConfig;
} & IFrameTransport;
