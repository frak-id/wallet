import { Elysia } from "elysia";
import ky from "ky";
import { Config } from "sst/node/config";

/**
 * Build the common context for the app
 */
export const indexerApiContext = new Elysia({
    name: "Context.indexerApi",
}).decorate(
    { as: "append" },
    {
        indexerApi: ky.create({ prefixUrl: Config.INDEXER_URL }),
    }
);
