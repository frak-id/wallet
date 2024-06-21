import { cacheExchange, createClient, fetchExchange } from "@urql/core";
import { registerUrql } from "@urql/next/rsc";

const makeClient = () => {
    return createClient({
        url: "https://indexer.frak.id/",
        exchanges: [cacheExchange, fetchExchange],
    });
};

export const { getClient } = registerUrql(makeClient);
