import { Elysia } from "elysia";
import { DnsCheckRepository } from "./repositories/DnsCheckRepository";
import { MintRepository } from "./repositories/MintRepository";

/**
 * Context for the business domain
 */
export const businessContext = new Elysia({
    name: "Context.business",
})
    .decorate({
        business: {
            repositories: {
                dnsCheck: new DnsCheckRepository(),
                mint: new MintRepository(),
            },
        },
    })
    .as("scoped");

export type BusinessContext = typeof businessContext;
