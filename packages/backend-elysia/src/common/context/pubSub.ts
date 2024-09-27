import { PubSubRepository } from "@backend-common/repositories/PubSubRepository";
import { Elysia } from "elysia";

/**
 * Build the common context for the app
 */
export const pubSubContext = new Elysia({
    name: "pub-sub-context",
}).decorate(
    { as: "append" },
    {
        pubSubRepository: new PubSubRepository(),
    }
);
