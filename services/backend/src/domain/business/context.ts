import { DnsCheckRepository } from "./repositories/DnsCheckRepository";
import { MintRepository } from "./repositories/MintRepository";

/**
 * Context for the business domain
 */
export namespace BusinessContext {
    export const repositories = {
        dnsCheck: new DnsCheckRepository(),
        mint: new MintRepository(),
    };
}
