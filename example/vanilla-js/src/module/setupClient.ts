import type { NexusClient } from "@frak-labs/nexus-sdk/core";
import { frakConfig } from "./config";

export function setupFrakClient(): Promise<NexusClient | null> {
    return new Promise((resolve) => {
        window.NexusSDK.createIframe({
            walletBaseUrl: frakConfig.walletUrl,
        }).then((iframe) => {
            if (iframe) {
                resolve(
                    window.NexusSDK.createIFrameNexusClient({
                        config: frakConfig,
                        iframe,
                    })
                );
            } else {
                resolve(null);
            }
        });
    });
}
