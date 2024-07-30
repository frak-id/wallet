import { cacheExchange, createClient, fetchExchange } from "@urql/core";
import { registerUrql } from "@urql/next/rsc";

const makeClient = () => {
    return createClient({
        url: "https://indexer.frak.id/graphql",
        exchanges: [cacheExchange, fetchExchange],
    });
};

export const { getClient } = registerUrql(makeClient);
