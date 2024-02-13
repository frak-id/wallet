import {
    getPricesEvent,
    getUnlockStatusEvent,
    parseGetPricesEventResponse,
} from "../events";
import { parseUnlockStatusEventResponse } from "../events/status.ts";
import type {
    EventResponseFromParam,
    EventsFormat,
    EventsParam,
    FrakWalletSdkConfig,
} from "../types";
import { Deferred } from "./Deferred.ts";

/**
 * Represent a query provider interface (base class that should be used to query data to the Frak wallet via iframe)
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
    private readonly _iframeWindow: Window;

    /**
     * All the one shot resolvers
     * @private
     */
    private readonly _messageResolvers: Map<
        string,
        (event: EventsFormat) => unknown
    > = new Map();

    constructor({
        iframe,
        config,
    }: {
        config: FrakWalletSdkConfig;
        iframe: HTMLIFrameElement;
    }) {
        if (typeof window === "undefined") {
            throw new Error("QueryProvider should be used in the browser");
        }

        if (!iframe.contentWindow) {
            throw new Error("Iframe should have a contentWindow");
        }

        this._iframeWindow = iframe.contentWindow;
        this._config = config;

        // Setup the message listener
        window.addEventListener("message", this.handleNewMessage);
    }

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
            const parsedEvent = this.parseEventRequest({
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
            const parsedEvent = await this.parseEventRequest({
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
            return await getPricesEvent(this._config, param.value);
        }

        // Format unlock status param
        if (param.key === "unlock-status-param") {
            return await getUnlockStatusEvent(this._config, param.value);
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
    private async parseEventRequest<Param extends EventsParam>({
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

    /**
     * Handle an incoming message
     * @param message
     * @private
     */
    private handleNewMessage(message: MessageEvent<EventsFormat>) {
        // Check that the origin match the current window url
        if (message?.origin !== window.origin) {
            return;
        }

        // Ensure we got enverything in the response
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
}
