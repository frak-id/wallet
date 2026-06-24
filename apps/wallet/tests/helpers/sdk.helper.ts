import type {
    DisplayEmbeddedWalletParamsType,
    DisplayModalParamsType,
    FrakClient,
    ModalStepTypes,
} from "@frak-labs/core-sdk";
import { expect, type JSHandle, type Page } from "@playwright/test";

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

// Modal-open retry budget: the SDK occasionally drops the first open request,
// so we re-fire up to N times, with a longer wait on the final attempt.
const MODAL_OPEN_ATTEMPTS = 3;
const MODAL_OPEN_TIMEOUT_MS = 6_000;
const MODAL_OPEN_FINAL_TIMEOUT_MS = 15_000;
// Bound the connection/setup gate so a failed handshake fails fast (with a
// clear error) instead of hanging to the test timeout.
const SDK_SETUP_TIMEOUT_MS = 20_000;

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
        // A request fired before the handshake + post-connection setup is
        // dropped (modal never opens), so gate on both — bounded so a failed
        // handshake fails fast rather than hanging to the test timeout.
        const client = await this.walletClient;
        await client.evaluate(async (c, timeoutMs) => {
            const timeout = new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error("SDK connection/setup timed out")),
                    timeoutMs
                )
            );
            await Promise.race([
                Promise.all([c.waitForConnection, c.waitForSetup]),
                timeout,
            ]);
        }, SDK_SETUP_TIMEOUT_MS);
    }

    // The open request is occasionally dropped; re-fire until the modal mounts.
    // The isVisible() guard avoids re-firing a slow-but-successful open (which
    // would dispatch a duplicate request and overwrite __frakModalResult).
    private async fireUntilModalOpen(fire: () => Promise<void>) {
        const body = this.page.frameLocator("#frak-wallet").locator("body");
        for (let attempt = 0; attempt < MODAL_OPEN_ATTEMPTS; attempt++) {
            if (await body.isVisible()) return;
            await fire();
            try {
                await expect(body).toBeVisible({
                    timeout:
                        attempt === MODAL_OPEN_ATTEMPTS - 1
                            ? MODAL_OPEN_FINAL_TIMEOUT_MS
                            : MODAL_OPEN_TIMEOUT_MS,
                });
                return;
            } catch {
                // Not visible within the budget — re-fire on the next attempt.
            }
        }
        throw new Error("Modal did not open");
    }

    async openWalletModal(params?: DisplayEmbeddedWalletParamsType) {
        const walletClient = await this.walletClient;
        await this.fireUntilModalOpen(() =>
            walletClient.evaluate((client, params) => {
                // Fire-and-forget: the embedded wallet request stays open.
                client
                    .request({
                        method: "frak_displayEmbeddedWallet",
                        params: [params ?? {}, { name: "e2e test" }],
                    })
                    .catch(() => {});
            }, params)
        );
    }

    /**
     * Trigger `frak_displayModal` and stash the pending promise on `window` so
     * the spec can interact with the modal before reading the outcome via
     * {@link getModalResult}.
     */
    async displayModal(steps: ModalSteps, metadata?: ModalMetadata) {
        const walletClient = await this.walletClient;
        await this.fireUntilModalOpen(() =>
            walletClient.evaluate(
                (client, { steps, metadata }) => {
                    const w = window as unknown as {
                        __frakModalResult?: Promise<unknown>;
                    };
                    w.__frakModalResult = client.request({
                        method: "frak_displayModal",
                        params: [steps, metadata, { name: "e2e test" }],
                    });
                    // Spec reads success/failure via getModalResult().
                    w.__frakModalResult.catch(() => {});
                },
                { steps, metadata }
            )
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
