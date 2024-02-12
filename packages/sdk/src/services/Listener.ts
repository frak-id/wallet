import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price.ts";
import RxPostmessenger from "rx-postmessenger";
// @ts-ignore
import type { Messenger, Request } from "rx-postmessenger";
import { getPricesResponseEvent, parseGetPricesEventData } from "../events";
import type { EventsFormat, GetPricesParam } from "../types";

const LISTENER_URL = "http://localhost:3001";

export class Listener {
    /**
     * The messenger that will be used to communicate with the provider
     */
    messenger: Messenger = undefined;

    /**
     * The price fetcher function that will be used to fetch the prices
     */
    public priceFetcher:
        | (({ contentId, articleId }: GetPricesParam) => Promise<{
              prices: ArticlePriceForUser[];
          }>)
        | undefined;

    constructor() {
        if (typeof window === "undefined") {
            return;
        }

        this.init();
        this.listeners();
    }

    /**
     * Initialize the listener
     */
    init() {
        this.messenger = RxPostmessenger.connect(window.parent, LISTENER_URL);
    }

    /**
     * Destroy the listener
     */
    destroy() {}

    /**
     * Create the emitter listeners
     */
    listeners() {
        this.messenger
            .requests("get-price")
            .subscribe(this.handleGetPriceRequest.bind(this));
    }

    /**
     * Set the price fetcher
     * @param callback
     */
    setPriceFetcher(
        callback: ({ contentId, articleId }: GetPricesParam) => Promise<{
            prices: ArticlePriceForUser[];
        }>
    ) {
        this.priceFetcher = callback;
    }

    /**
     * Handle the get-price event request
     * @param request
     */
    async handleGetPriceRequest(request: Request<EventsFormat>) {
        if (!request.payload) return;

        // Parse the event data
        const { articleId, contentId } = await parseGetPricesEventData(
            request.payload
        );

        // Fetch the prices
        const prices = await this.priceFetcher?.({ articleId, contentId });
        if (!prices) {
            console.error(
                `No prices found for articleId ${articleId} and contentId ${contentId}`
            );
            return;
        }

        // Respond with the prices
        const responseEvent = await getPricesResponseEvent(prices);
        if (!responseEvent) return;
        request.respond(responseEvent);
    }
}
