import * as dns from "node:dns";
import { promisify } from "node:util";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { flat } from "radash";
import { type Address, concatHex, keccak256, toHex } from "viem";
import { URL } from "whatwg-url";

/**
 * Repository used to check for DNS records
 */
export class DnsCheckRepository {
    /**
     * Get the normalized domain from a given domain
     */
    getNormalizedDomain(domain: string) {
        return new URL(domain).host;
    }

    /**
     * Get the DNS txt record waited for the given domain
     */
    getDnsTxtString({ domain, owner }: { domain: string; owner: Address }) {
        // Normalise the domain (only getting the host from it)
        const host = this.getNormalizedDomain(domain);

        // Compute the hash
        const hash = keccak256(concatHex([toHex(host), owner]));
        return `frak-business; hash=${hash}`;
    }

    /**
     * Check if the DNS txt record is set for the given domain
     * @param domain
     */
    async isDnsTxtRecordSet({
        domain,
        owner,
    }: { domain: string; owner: Address }) {
        // If not running in prod, return true
        if (!isRunningInProd) return true;
        // Get the waited txt record
        const waitedTxtRecord = this.getDnsTxtString({ domain, owner });
        try {
            // Try to resolve the TXT records for the domain
            const records = flat(await promisify(dns.resolveTxt)(domain));
            return records.includes(waitedTxtRecord);
        } catch {
            return false;
        }
    }
}
