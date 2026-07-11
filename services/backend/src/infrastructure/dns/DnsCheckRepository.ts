import * as dns from "node:dns";
import { promisify } from "node:util";
import { isRunningInProd } from "@frak-labs/app-essentials";
import {
    type Address,
    concatHex,
    type Hex,
    isHex,
    keccak256,
    toHex,
} from "viem";

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
 * Public identifier a setup code binds to. Unlike the DNS TXT owner (which
 * keys walletless accounts on their server-generated `accountId`), the setup
 * code binds to something known up front so it can be generated live during
 * onboarding without a DB lookup: the wallet address for wallet users, or the
 * (normalised) account email for walletless users. Returns `null` when no
 * such identifier is available (e.g. a walletless account with no email).
 */
function setupCodeSubject(
    owner: DnsProofOwner,
    email?: string | null
): Hex | null {
    if ("wallet" in owner) return owner.wallet;
    if (email) return toHex(email.trim().toLowerCase());
    return null;
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
        email,
    }: {
        domain: string;
        owner: DnsProofOwner;
        setupCode?: string;
        /**
         * Account email for the walletless setup-code path. The code binds to
         * wallet OR email (see `setupCodeSubject`), so both wallet and email
         * users can be issued one live at onboarding.
         */
        email?: string | null;
    }) {
        // A setup code is an offline-issued alternative to the DNS TXT proof,
        // bound to `domain + subject + salt` where the subject is the owner's
        // stable public identifier (wallet address, else account email).
        if (setupCode && isHex(setupCode)) {
            const subject = setupCodeSubject(owner, email);
            if (subject) {
                const hash = keccak256(
                    concatHex([
                        toHex(domain),
                        subject,
                        toHex(process.env.PRODUCT_SETUP_CODE_SALT as string),
                    ])
                );
                if (BigInt(hash) === BigInt(setupCode)) return true;
            }
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
