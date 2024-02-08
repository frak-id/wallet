import Emittery from "emittery";
import type { EventsFormat } from "../types";

type MessagesEvent = {
    "get-price": EventsFormat;
    "unlock-status": EventsFormat;
};

export class Provider {
    /**
     * Event emitter that will be used to emit messages to the listener
     * @private
     */
    emitter: Emittery<MessagesEvent> = new Emittery<MessagesEvent>();

    /**
     * The iframe that will be used to communicate with the listener
     * @private
     */
    private iframe: HTMLIFrameElement | null = null;

    /**
     * The message event listener
     * @private
     */
    private readonly messages: (event: MessageEvent) => void;

    constructor() {
        console.log("Provider constructor");
        // this.listeners();
        this.messages = this.handleMessages.bind(this);

        if (typeof window === "undefined") {
            return;
        }

        this.init();
    }

    /**
     * Initialize the provider
     */
    init() {
        console.log("Provider init");
        this.iframe = this.createIframe();
        window.addEventListener("message", this.messages, false);
    }

    /**
     * Destroy the provider
     */
    destroy() {
        console.log("Provider destroy");
        window.removeEventListener("message", this.messages, false);
        this.iframe?.parentNode?.removeChild(this.iframe);
    }

    /**
     * Create the emitter listeners
     */
    listeners() {
        /*this.emitter.on("get-price", (data) => {
            console.log("provider get-price", data);
        });
        this.emitter.on("unlock-status", (data) => {
            console.log("provider unlock-status", data);
        });*/
    }

    /**
     * Handle the messages from the listener
     * @param event
     */
    handleMessages(
        event: MessageEvent<{ source: string; data: EventsFormat }>
    ) {
        if (
            event.origin !== "http://localhost:3000" ||
            event?.data?.source !== "frak"
        ) {
            return;
        }
        const { data } = event.data;
        this.emitter.emit(data.topic, data);
    }

    /**
     * Emit a message to the listener
     */
    emitToListener(data: EventsFormat) {
        this?.iframe?.contentWindow?.postMessage(
            {
                source: "frak",
                data,
            },
            "http://localhost:3000"
        );
    }

    /**
     * Create the iframe
     * @private
     */
    createIframe() {
        const iframe = document.createElement("iframe");
        iframe.name = "frak-wallet";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.position = "absolute";
        iframe.style.top = "-1000px";
        iframe.style.left = "-1000px";
        document.body.appendChild(iframe);

        iframe.addEventListener("load", () => {
            console.log("listener frame loaded");
        });
        iframe.src = "http://localhost:3000/listener";
        return iframe;
    }
}
