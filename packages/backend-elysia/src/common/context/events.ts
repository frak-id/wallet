import { EventEmitter } from "node:events";
import type { FrakEvents } from "@backend-utils";
import { Elysia } from "elysia";

/**
 * Build the common context for the app
 */
export const eventsContext = new Elysia({
    name: "Context.event",
}).decorate(
    { as: "append" },
    {
        emitter: new EventEmitter<FrakEvents>({ captureRejections: true }),
    }
);
