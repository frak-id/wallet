import { frakWalletSdkConfig } from "@frak-wallet/example/src/context/frak-wallet/config";
// @ts-ignore
import type { Messenger } from "rx-postmessenger";
import RxPostmessenger from "rx-postmessenger";
import { concatMap } from "rxjs";
import { fromPromise } from "rxjs/internal/observable/innerFrom";
import type { Observable } from "rxjs/src/internal/Observable.ts";
import type { Hex } from "viem";
import { getPricesEvent, parseGetPricesEventResponse } from "../events";
import type { EventsFormat, GetPricesResponse } from "../types";

const PROVIDER_URL = "http://localhost:3000";

/**
 * TODO: By checking source code of 'rx-postmessenger' it's maybe overkill in comparaison with our use cases
 *  - Since the EventFormat already contain a key, we can use it and respond to message
 *  - The msg id and channel type of rx-postmessenger is just an fancier way to do it, with shit ton of rxjs everywhere in the code
 *  - Should check the performance impact between that and classic postMessage stuff (both in term of resources consumption and in term of delay)
 *  - A potential inspiration by Tezos wallet team: https://github.com/airgap-it/beacon-sdk
 *  - Simple postmessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 *  - Simple flow with postMessage and response, using differents key for requesting data and responding with the data, should do it easily
 *  - The only concern would be around the flow for the unlock state
 *      - Should create smth like a notification channel
 *      - The notification channel would contain an id, state (open : close), and the method to send the event to
 *      - The method would be a simple wrapper around event.origin.postMessage of when it was requested
 */
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
    }: { articleId: Hex }): Observable<GetPricesResponse> {
        // Build price event to be sent to the listener
        const priceEvent = await getPricesEvent(frakWalletSdkConfig, {
            articleId,
        });

        // Send the event to the listener
        const getPriceResponseFlow = this.messenger.request<
            EventsFormat,
            EventsFormat
        >("get-price", priceEvent);

        // TODO: Map the flow to the response via the parseGetPricesEventResponse function and return an observable
        // TODO: Use notify to send the unlock status data

        // Map the flow with the event decoder
        // Return the mapped observer flow
        return getPriceResponseFlow.pipe(
            concatMap<EventsFormat, Observable<GetPricesResponse>>((event) =>
                fromPromise(parseGetPricesEventResponse(event))
            )
        );
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
