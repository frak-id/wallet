import { getPricesResponseEvent, parseGetPricesEventData } from "../events";
import {
    getUnlockStatusResponseEvent,
    parseUnlockStatusEvent,
} from "../events";
import type {
    DecompressedFormat,
    EventsFormat,
    GetPricesParam,
    GetPricesResponse,
    GetUnlockStatusParam,
    GetUnlockStatusResponse,
} from "../types";

/**
 * Represent a query listener, it's listening to the iframe and send response
 */
export class QueryListener {
    /**
     * Method used to fetch the price params
     */
    private _onPriceRequested: (
        param: GetPricesParam
    ) => Promise<GetPricesResponse | undefined> = async (_) => {
        return undefined;
    };
    public set onPriceRequested(value: (
        param: GetPricesParam
    ) => Promise<GetPricesResponse | undefined>) {
        this._onPriceRequested = value;
    }

    /**
     * Method used when the unlock status is requested
     */
    private _onStatusRequested: (
        param: GetUnlockStatusParam,
        emitter: (response: GetUnlockStatusResponse) => Promise<void>
    ) => Promise<void> = async () => {};
    public set onStatusRequested(value: (
        param: GetUnlockStatusParam,
        emitter: (response: GetUnlockStatusResponse) => void
    ) => Promise<void>) {
        this._onStatusRequested = value;
    }

    constructor() {
        if (typeof window === "undefined") {
            throw new Error("QueryProvider should be used in the browser");
        }

        // Setup the message listener
        window.addEventListener("message", this.handleNewMessage.bind(this));
    }

    /**
     * Handle an incoming message
     * @param message
     * @private
     */
    private async handleNewMessage(message: MessageEvent<EventsFormat>) {
        // TODO: Check that the origin match one of our providers
        /*if (message?.origin !== window.origin) {
            return;
        }*/

        console.log("Received a new message", { data: message.data });

        // Ensure we got everything in the response
        if (!(message?.data?.id && message?.data?.topic)) {
            return;
        }

        // Build our response emitter
        const responseEmitter = (event: EventsFormat) => {
            console.log("Emitting a new response", {
                event,
                source: message.source,
            });
            message.source?.postMessage(event, {
                targetOrigin: message.origin,
            });
        };

        // Parse the params
        const event = await this.parseEventRequest({ event: message.data });
        console.log("Parsed event", { event });

        // Depending on the type, we will call the right method
        if (event.topic === "get-price-param") {
            await this.handlePriceRequest(
                event as DecompressedFormat<GetPricesParam>,
                responseEmitter
            );
        }
        if (event.topic === "unlock-status-param") {
            await this.handleStatusRequest(
                event as DecompressedFormat<GetUnlockStatusParam>,
                responseEmitter
            );
        }
    }

    /**
     * Format an event response
     * @param param
     * @private
     */
    private async parseEventRequest<DataType>({
        event,
    }: { event: EventsFormat }): Promise<DecompressedFormat<DataType>> {
        // Decode the event according to the topic
        if (event.topic === "get-price-param") {
            return (await parseGetPricesEventData(
                event
            )) as DecompressedFormat<DataType>;
        }

        if (event.topic === "unlock-status-param") {
            return (await parseUnlockStatusEvent(
                event
            )) as DecompressedFormat<DataType>;
        }

        // Unknown event
        throw new Error(`Unknown event param key: ${JSON.stringify(event)}`);
    }

    /**
     * Handle a price request
     * @param param
     * @param eventEmitter
     * @private
     */
    private async handlePriceRequest(
        param: DecompressedFormat<GetPricesParam>,
        eventEmitter: (event: EventsFormat) => void
    ) {
        // Get the response from the handler
        const response = await this._onPriceRequested(param.data);

        // If we don't get a response, we send it back
        if (!response) {
            console.error("No response for the price request");
            return;
        }

        // Otherwise build the response
        const formattedResponse = await getPricesResponseEvent(
            response,
            param.id
        );

        // And emit it
        eventEmitter(formattedResponse);
    }

    /**
     * Handle an unlock status request
     * @param param
     * @param eventEmitter
     * @private
     */
    private async handleStatusRequest(
        param: DecompressedFormat<GetPricesParam>,
        eventEmitter: (event: EventsFormat) => void
    ) {
        // Build the response emitter
        const responseEmitter = async (response: GetUnlockStatusResponse) => {
            // Format the response
            const formattedResponse = await getUnlockStatusResponseEvent(
                response,
                param.id
            );

            // And emit it
            eventEmitter(formattedResponse);
        };

        // Tell that a status is requested
        await this._onStatusRequested(param.data, responseEmitter);
    }
}
