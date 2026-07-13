import { log } from "@backend-infrastructure";
import { type Address, isAddress } from "viem";

/**
 * Email domain whose verified holders are platform admins (design doc §7.3).
 * Verification is the trust gate: an unverified email claim grants nothing.
 */
const PLATFORM_ADMIN_EMAIL_DOMAIN = "@frak-labs.com";

/**
 * Resolves whether a wallet is granted platform-admin read-only access to
 * all merchants. The allow-list is parsed once (lazily) from
 * process.env.PLATFORM_ADMIN_WALLETS (comma-separated) into a memoized Set
 * of lowercased addresses. Business accounts with a VERIFIED @frak-labs.com
 * email are platform admins too (`isPlatformAdminAccount`).
 */
export class PlatformAdminService {
    private cache: Set<string> | null = null;

    private getAdminSet(): Set<string> {
        if (this.cache !== null) return this.cache;

        const raw = process.env.PLATFORM_ADMIN_WALLETS ?? "";
        const set = new Set<string>();

        for (const entry of raw.split(",")) {
            const addr = entry.trim();
            if (!addr) continue;
            // { strict: false } skips EIP-55 checksum validation intentionally:
            // all entries are normalised to lowercase before Set insertion and
            // all lookups are lowercased too, so checksum correctness is irrelevant.
            if (!isAddress(addr, { strict: false })) {
                log.warn(
                    { entry: addr },
                    "PLATFORM_ADMIN_WALLETS: invalid address entry skipped"
                );
                continue;
            }
            set.add(addr.toLowerCase());
        }

        this.cache = set;
        return set;
    }

    isPlatformAdmin(wallet: Address): boolean {
        return this.getAdminSet().has(wallet.toLowerCase());
    }

    /**
     * Account-based platform-admin check: verified @frak-labs.com email.
     * Accepts the account row (or null) so callers decide how to fetch it —
     * this service stays repository-free.
     */
    isPlatformAdminAccount(
        account: { email: string | null; emailVerifiedAt: Date | null } | null
    ): boolean {
        if (!account?.email || !account.emailVerifiedAt) return false;
        return account.email
            .toLowerCase()
            .endsWith(PLATFORM_ADMIN_EMAIL_DOMAIN);
    }
}
