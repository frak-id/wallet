import {
    getPricesEvent,
    getUnlockStatusEvent,
    parseGetPricesEventResponse,
} from "../events";
import { parseUnlockStatusEventResponse } from "../events";
import type {
    EventResponseFromParam,
    EventsFormat,
    EventsParam,
    FrakWalletSdkConfig,
} from "../types";
import { Deferred } from "./Deferred";

/**
 * Represent a query provider (base class that should be used to query data to the Frak wallet via iframe)
 */
export class QueryProvider {
    /**
     * The configuration of the Frak wallet SDK
     * @private
     */
    private readonly _config: FrakWalletSdkConfig;

    /**
     * The iframe in which we will send request
     * @private
     */
    private readonly _iframe: HTMLIFrameElement;

    /**
     * The iframe in which we will send request
     * @private
     */
    private readonly _iframeWindow: Window;

    /**
     * The listener linked promise
     * @private
     */
    private readonly _listenerLinked: Deferred<boolean> =
        new Deferred<boolean>();

    /**
     * All the one shot resolvers
     * @private
     */
    private readonly _messageResolvers: Map<
        string,
        (event: EventsFormat) => unknown
    > = new Map();

    /**
     * The  current message handler we are using
     * @private
     */
    private readonly _messageHandler: (
        message: MessageEvent<EventsFormat>
    ) => void;

    /**
     * Static method to create an invisible iframe that will be used to fetch data
     */
    public static createIframe({
        walletBaseUrl,
    }: { walletBaseUrl: string }): Promise<HTMLIFrameElement> {
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
            iframe.src = `${walletBaseUrl}/listener`;
        });
    }

    constructor({
        iframe,
        config,
    }: {
        config: FrakWalletSdkConfig;
        iframe: HTMLIFrameElement;
    }) {
        console.log("Creating a new query provider");
        if (typeof window === "undefined") {
            throw new Error("QueryProvider should be used in the browser");
        }

        if (!iframe.contentWindow) {
            throw new Error("Iframe should have a contentWindow");
        }

        this._iframe = iframe;
        this._iframeWindow = iframe.contentWindow;
        this._config = config;

        // Setup the message listener
        this._messageHandler = this.handleNewMessage.bind(this);
        window.addEventListener("message", this._messageHandler);
    }

    /**
     * Wait for the listener message handler to be linked
     */
    public async waitForListenerLink() {
        await this._listenerLinked.promise;
    }

    /**
     * Destroy the query provider
     */
    public destroy() {
        console.log("Destroying the query provider");
        // Cleanup our receiver
        this._messageResolvers.clear();
        // Remove the message listener
        window.removeEventListener("message", this._messageHandler);
        // Remove the iframe
        this._iframe.remove();
    }

    /**
     * Handle an incoming message
     * @param message
     * @private
     */
    private handleNewMessage(
        message: MessageEvent<EventsFormat | { topic: "ready" }>
    ) {
        console.log("Received a new message in the listener", {
            data: message.data,
        });

        if (!message.origin) {
            return;
        }
        // Check that the origin match the wallet
        if (
            new URL(message.origin).origin !==
            new URL(this._config.walletUrl).origin
        ) {
            return;
        }

        // If it's a ready topic, resolve the listener linked promise
        if (message?.data?.topic === "ready") {
            this._listenerLinked.resolve(true);
            return;
        }

        // Ensure we got everything in the response
        if (!(message?.data?.id && message?.data?.topic)) {
            return;
        }

        // Try to find a current resolver=
        const resolver = this._messageResolvers.get(message.data.id);

        // If no resolver found, exit
        if (!resolver) {
            return;
        }

        // Resolve the data
        resolver(message.data);
    }

    /**
     * Perform a one shot request (getting the response in an sync)
     * @param param
     */
    public async oneShotRequest<Param extends EventsParam>({
        param,
    }: { param: Param }): Promise<EventResponseFromParam<Param>> {
        // Format the window request
        const formattedRequest = await this.formatEventRequest({ param });

        // Get the id (to insert in the resolver)
        const id = formattedRequest.id;

        // Create our deferred response
        const deferredResponse = new Deferred<EventResponseFromParam<Param>>();

        // Set our resolver (expose a promise that will be resolved when the response is received)
        const executor = (event: EventsFormat) => {
            // Parse the response according to the request
            const parsedEvent = this.parseEventResponse({
                param,
                response: event,
            });
            deferredResponse.resolve(parsedEvent);
        };
        this._messageResolvers.set(id, executor);

        // Post the request
        this._iframeWindow.postMessage(formattedRequest, {
            targetOrigin: this._config.walletUrl,
        });

        // Return the promise that is waiting for the reply
        return deferredResponse.promise;
    }

    /**
     * Perform a request with listener for every response coming in
     * @param param
     * @param onResponse
     */
    public async listenerRequest<Param extends EventsParam>({
        param,
        onResponse,
    }: {
        param: Param;
        onResponse: (response: EventResponseFromParam<Param>) => void;
    }): Promise<{ listenerId: string }> {
        // Format the window request
        const formattedRequest = await this.formatEventRequest({ param });

        // Get the id (to insert in the resolver)
        const id = formattedRequest.id;

        // Set our resolver (expose a promise that will be resolved when the response is received)
        const executor = async (event: EventsFormat) => {
            // Parse the response according to the request
            const parsedEvent = await this.parseEventResponse({
                param,
                response: event,
            });
            onResponse(parsedEvent);
        };
        this._messageResolvers.set(id, executor);

        // Post the request
        this._iframeWindow.postMessage(formattedRequest, {
            targetOrigin: this._config.walletUrl,
        });

        // Return the listener id
        return { listenerId: id };
    }

    /**
     * Remove a listener
     * @param listenerId
     */
    public removeListener({ listenerId }: { listenerId: string }) {
        this._messageResolvers.delete(listenerId);
    }

    /**
     * Format an event request
     * @param param
     * @private
     */
    private async formatEventRequest<Param extends EventsParam>({
        param,
    }: { param: Param }): Promise<EventsFormat> {
        // Format the get price param
        if (param.key === "get-price-param") {
            return await getPricesEvent(param.value);
        }

        // Format unlock status param
        if (param.key === "unlock-status-param") {
            return await getUnlockStatusEvent(param.value);
        }

        // Unknown event
        throw new Error(`Unknown event key: ${JSON.stringify(param)}`);
    }

    /**
     * Format an event response
     * @param param
     * @param response
     * @private
     */
    private async parseEventResponse<Param extends EventsParam>({
        param,
        response,
    }: { param: Param; response: EventsFormat }): Promise<
        EventResponseFromParam<Param>
    > {
        // Format the get price param
        if (
            param.key === "get-price-param" &&
            response.topic === "get-price-response"
        ) {
            return (await parseGetPricesEventResponse(
                response
            )) as EventResponseFromParam<Param>;
        }

        // Format unlock status param
        if (
            param.key === "unlock-status-param" &&
            response.topic === "unlock-status-response"
        ) {
            return (await parseUnlockStatusEventResponse(
                response
            )) as EventResponseFromParam<Param>;
        }

        // Unknown event
        throw new Error(
            `Unknown event response key: ${JSON.stringify(response)}`
        );
    }
}
