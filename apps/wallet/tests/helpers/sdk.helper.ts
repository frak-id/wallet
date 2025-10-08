import type {
    DisplayEmbeddedWalletParamsType,
    FrakClient,
} from "@frak-labs/core-sdk";
import type { JSHandle, Page } from "@playwright/test";

/**
 * Helper class to test the listener
 *  - Basicly load the vanilla example website and use it for e2e testing
 *
 * todo: Override the window.frakSetup.config url for the url of this e2e test
 */
export class SdkHelper {
    constructor(private readonly page: Page) {}
    /**
     * Get a JSHandle arround the FrakClient of the SDK
     */
    get walletClient(): Promise<JSHandle<FrakClient>> {
        return this.page
            .evaluateHandle(
                () =>
                    (window as unknown as { FrakSetup: { client: FrakClient } })
                        .FrakSetup?.client
            )
            .then((client) => {
                if (!client) {
                    throw new Error("Frak client not setup");
                }

                return client;
            });
    }

    async init() {
        // todo: add an init script to overide frakConfig? Should be deferred, like update the window.frakSetup.config only once load, just before the init

        // Go the vanilla website
        await this.page.goto("https://vanilla.frak-labs.com/", {
            waitUntil: "networkidle",
        });
    }

    async openWalletModal(params?: DisplayEmbeddedWalletParamsType) {
        const walletClient = await this.walletClient;
        await walletClient.evaluate((client, params) => {
            // Do not wait for the return here
            client.request({
                method: "frak_displayEmbeddedWallet",
                params: [params ?? {}, { name: "e2e test" }],
            });
        }, params);
    }
}
