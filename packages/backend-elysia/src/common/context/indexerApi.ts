import { Elysia } from "elysia";
import ky from "ky";

/**
 * Build the common context for the app
 */
export const indexerApiContext = new Elysia({
    name: "Context.indexerApi",
}).decorate(
    { as: "append" },
    {
        indexerApi: ky.create({ prefixUrl: process.env.INDEXER_URL }),
    }
);
