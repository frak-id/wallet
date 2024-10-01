import * as dns from "node:dns";
import { promisify } from "node:util";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import { flat } from "radash";
import { keccak256, toHex } from "viem";
import { URL } from "whatwg-url";

/**
 * Repository used to check for DNS records
 */
export class DnsCheckRepository {
    // Cache of dns TXT string for a given product domain
    private readonly dnsTxtCache = new LRUCache<string, string>({
        max: 32,
    });

    /**
     * Get the normalized domain from a given domain
     */
    getNormalizedDomain(domain: string) {
        return new URL(domain).host;
    }

    /**
     * Get the DNS txt record waited for the given domain
     */
    getDnsTxtString({ domain }: { domain: string }) {
        // Normalise the domain (only getting the host from it)
        const host = this.getNormalizedDomain(domain);

        // Check if got it in cache
        const cached = this.dnsTxtCache.get(host);
        if (cached) {
            return cached;
        }

        // Compute the hash
        const hash = keccak256(toHex(host));
        const txt = `frak-business; hash=${hash}`;
        this.dnsTxtCache.set(host, txt);
        return txt;
    }

    /**
     * Check if the DNS txt record is set for the given domain
     * @param domain
     */
    async isDnsTxtRecordSet({ domain }: { domain: string }) {
        // If not running in prod, return true
        if (!isRunningInProd) return true;
        // Get the waited txt record
        const waitedTxtRecord = this.getDnsTxtString({ domain });
        try {
            // Try to resolve the TXT records for the domain
            const records = flat(await promisify(dns.resolveTxt)(domain));
            return records.includes(waitedTxtRecord);
        } catch {
            return false;
        }
    }
}
