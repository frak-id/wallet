import * as dns from "node:dns";
import { promisify } from "node:util";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { type Address, concatHex, isHex, keccak256, toHex } from "viem";

/**
 * Identity a DNS TXT proof binds to: a wallet address (SIWE registration)
 * or a business account id (walletless registration, design doc §4.10).
 */
export type DnsProofOwner = { wallet: Address } | { accountId: string };

/** Hash input for the owner half of the TXT record. */
function ownerToHex(owner: DnsProofOwner) {
    return "wallet" in owner ? owner.wallet : toHex(owner.accountId);
}

/**
 * Repository used to check for DNS records
 */
export class DnsCheckRepository {
    /**
     * Get the normalized domain from a given domain
     */
    getNormalizedDomain(domain: string) {
        const baseDomainUrl = domain.startsWith("https://")
            ? domain
            : `https://${domain}`;
        const domainHost = new URL(baseDomainUrl).host;
        return domainHost.replace("www.", "");
    }

    /**
     * Get the DNS txt record waited for the given domain
     */
    getDnsTxtString({
        domain,
        owner,
    }: {
        domain: string;
        owner: DnsProofOwner;
    }) {
        // Normalise the domain (only getting the host from it)
        const host = this.getNormalizedDomain(domain);

        // Compute the hash
        const hash = keccak256(concatHex([toHex(host), ownerToHex(owner)]));
        return `frak-business; hash=${hash}`;
    }

    /**
     * Check if the DNS txt record is set for the given domain
     * @param domain
     * @param owner
     */
    async isValidDomain({
        domain,
        owner,
        setupCode,
    }: {
        domain: string;
        owner: DnsProofOwner;
        setupCode?: string;
    }) {
        // If we got a setup code (wallet flow only — the Shopify embedded
        // mint generates it from the wallet address)
        if (setupCode && isHex(setupCode) && "wallet" in owner) {
            // Rebuild the hash
            const hash = keccak256(
                concatHex([
                    toHex(domain),
                    owner.wallet,
                    toHex(process.env.PRODUCT_SETUP_CODE_SALT as string),
                ])
            );
            // Check if the hash is the same as the setup code
            const isValidCode = BigInt(hash) === BigInt(setupCode);
            if (isValidCode) return true;
        }

        // Otherwise, proceed with dns check
        return this.isDnsTxtRecordSet({ domain, owner });
    }

    /**
     * Check if the DNS txt record is set for the given domain
     * @param domain
     * @param owner
     */
    private async isDnsTxtRecordSet({
        domain,
        owner,
    }: {
        domain: string;
        owner: DnsProofOwner;
    }) {
        // If not running in prod, return true
        if (!isRunningInProd) return true;
        // Get the waited txt record
        const waitedTxtRecord = this.getDnsTxtString({ domain, owner });
        try {
            // Try to resolve the TXT records for the domain
            const records = await promisify(dns.resolveTxt)(domain);
            return records.flat().includes(waitedTxtRecord);
        } catch {
            return false;
        }
    }
}
