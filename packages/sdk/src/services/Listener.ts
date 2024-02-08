import Emittery from "emittery";
import type { EventsFormat } from "../types";

type MessagesEvent = {
    "get-price": EventsFormat;
    "unlock-status": EventsFormat;
};

export class Listener {
    /**
     * Event emitter that will be used to emit messages to the provider
     * @private
     */
    emitter: Emittery<MessagesEvent> = new Emittery<MessagesEvent>();

    /**
     * The message event listener
     * @private
     */
    private readonly messages: (event: MessageEvent) => void;

    constructor() {
        console.log("Listener constructor");
        // this.listeners();
        this.messages = this.handleMessages.bind(this);

        if (typeof window === "undefined") {
            return;
        }

        this.init();
    }

    /**
     * Initialize the listener
     */
    init() {
        console.log("Listener init");
        window.addEventListener("message", this.messages, false);
    }

    /**
     * Destroy the listener
     */
    destroy() {
        console.log("Listener destroy");
        window.removeEventListener("message", this.messages, false);
    }

    /**
     * Create the emitter listeners
     */
    listeners() {
        /*this.emitter.on("get-price", (data) => {
            console.log("listener get-price", data);
        });
        this.emitter.on("unlock-status", (data) => {
            console.log("listener unlock-status", data);
        });*/
    }

    /**
     * Handle the messages from the provider
     * @param event
     */
    handleMessages(
        event: MessageEvent<{ source: string; data: EventsFormat }>
    ) {
        if (
            event.origin !== "http://localhost:3001" ||
            event?.data?.source !== "frak"
        ) {
            return;
        }
        console.log("received message in /listener route", event.data);
        // console.log(event);
        const { data } = event.data;
        this.emitter.emit(data.topic, data);
    }

    /**
     * Emit a message to the provider
     */
    emitToProvider(data: EventsFormat) {
        window?.parent?.postMessage(
            {
                source: "frak",
                data,
            },
            "http://localhost:3001"
        );
    }
}
