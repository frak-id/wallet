import { frakWalletSdkConfig } from "@frak-wallet/example/src/context/frak-wallet/config";
import RxPostmessenger from "rx-postmessenger";
// @ts-ignore
import type { Messenger } from "rx-postmessenger";
import { firstValueFrom } from "rxjs";
import type { Hex } from "viem";
import { getPricesEvent, parseGetPricesEventResponse } from "../events";
import type { EventsFormat, GetPricesResponse } from "../types";

const PROVIDER_URL = "http://localhost:3000";

export class Provider {
    /**
     * The messenger that will be used to communicate with the listener
     */
    messenger: Messenger = undefined;

    /**
     * The iframe that will be used to communicate with the listener
     * @private
     */
    private iframe: HTMLIFrameElement | undefined = undefined;

    constructor() {
        if (typeof window === "undefined") {
            return;
        }

        this.init();
    }

    /**
     * Initialize the provider
     */
    async init() {
        // Create iframe and wait for it to load
        this.iframe = await this.createIframe();

        this.messenger = RxPostmessenger.connect(
            this.iframe?.contentWindow as Window,
            PROVIDER_URL
        );
    }

    /**
     * Destroy the provider
     */
    destroy() {
        this.iframe?.parentNode?.removeChild(this.iframe);
    }

    /**
     * Ask the listener for the prices of the article
     * @param articleId
     */
    async getPrices({
        articleId,
    }: { articleId: Hex }): Promise<GetPricesResponse> {
        // Build price event to be sent to the listener
        const priceEvent = await getPricesEvent(frakWalletSdkConfig, {
            articleId,
        });

        // Send the event to the listener
        const getPriceResponse$ = this.messenger.request(
            "get-price",
            priceEvent
        );

        // Wait for the listener to respond
        const responseFromListener =
            await firstValueFrom<EventsFormat>(getPriceResponse$);

        if (!responseFromListener) {
            console.log("No response from listener");
            return { prices: [] };
        }

        // Parse the response and respond with a compressed event
        return await parseGetPricesEventResponse(responseFromListener);
    }

    /**
     * Create the iframe
     * @private
     */
    private async createIframe(): Promise<HTMLIFrameElement> {
        const iframe = document.createElement("iframe");
        iframe.name = "frak-wallet";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.position = "absolute";
        iframe.style.top = "-1000px";
        iframe.style.left = "-1000px";
        document.body.appendChild(iframe);

        return new Promise((resolve) => {
            iframe?.addEventListener("load", () => resolve(iframe));
            iframe.src = `${PROVIDER_URL}/listener`;
        });
    }
}
