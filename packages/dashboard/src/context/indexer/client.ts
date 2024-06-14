import { Client, cacheExchange, fetchExchange } from "urql";

export const indexerClient = new Client({
    url: "https://indexer.frak.id/",
    exchanges: [cacheExchange, fetchExchange],
});
