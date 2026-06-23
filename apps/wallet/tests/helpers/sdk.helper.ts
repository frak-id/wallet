import type {
    DisplayEmbeddedWalletParamsType,
    DisplayModalParamsType,
    FrakClient,
    ModalStepTypes,
} from "@frak-labs/core-sdk";
import type { JSHandle, Page } from "@playwright/test";

type ModalSteps = DisplayModalParamsType<ModalStepTypes[]>["steps"];
type ModalMetadata = DisplayModalParamsType<ModalStepTypes[]>["metadata"];

/**
 * Host page that embeds the SDK (and therefore the listener iframe).
 *
 * Defaults to the deployed vanilla demo for back-compat; set
 * `FRAK_E2E_HOST_URL=http://localhost:3013/` to run against the locally served
 * `example/vanilla-js` harness (which points the iframe at the local wallet).
 */
const DEFAULT_HOST_URL =
    process.env.FRAK_E2E_HOST_URL ?? "https://vanilla.frak-labs.com/";

/**
 * Helper to test the listener through the SDK.
 *  - Loads a partner page that boots the SDK + listener iframe
 *  - Drives modal flows programmatically via the exposed `FrakSetup.client`
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

    async init(hostUrl: string = DEFAULT_HOST_URL) {
        // Go the partner website that boots the SDK
        await this.page.goto(hostUrl, { waitUntil: "domcontentloaded" });
        // The SDK boots asynchronously and keeps a live connection open to the
        // wallet iframe, so `networkidle` never settles. Wait for the client to
        // be exposed on `window` instead — that's the real "ready" signal.
        await this.page.waitForFunction(
            () =>
                Boolean(
                    (window as unknown as { FrakSetup?: { client?: unknown } })
                        .FrakSetup?.client
                ),
            undefined,
            { timeout: 15_000 }
        );
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

    /**
     * Trigger `frak_displayModal` and stash the pending promise on `window` so
     * the spec can interact with the modal before reading the outcome via
     * {@link getModalResult}.
     */
    async displayModal(steps: ModalSteps, metadata?: ModalMetadata) {
        const walletClient = await this.walletClient;
        await walletClient.evaluate(
            (client, { steps, metadata }) => {
                const w = window as unknown as {
                    __frakModalResult?: Promise<unknown>;
                };
                w.__frakModalResult = client.request({
                    method: "frak_displayModal",
                    params: [steps, metadata, { name: "e2e test" }],
                });
                // Swallow rejection here to avoid an unhandled rejection; the
                // spec reads success/failure through getModalResult().
                w.__frakModalResult.catch(() => {});
            },
            { steps, metadata }
        );
    }

    /**
     * Await the pending `displayModal` promise.
     * @returns the resolved step results, or the rejection message (e.g.
     * `clientAborted` when the user dismisses the modal mid-flow).
     */
    async getModalResult(): Promise<{ result?: unknown; error?: string }> {
        return this.page.evaluate(async () => {
            const w = window as unknown as {
                __frakModalResult?: Promise<unknown>;
            };
            if (!w.__frakModalResult) {
                return { error: "displayModal was not called" };
            }
            try {
                return { result: await w.__frakModalResult };
            } catch (e) {
                return {
                    error:
                        e && typeof e === "object" && "message" in e
                            ? String((e as { message: unknown }).message)
                            : String(e),
                };
            }
        });
    }
}
