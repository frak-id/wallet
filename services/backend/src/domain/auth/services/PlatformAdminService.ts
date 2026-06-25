import { log } from "@backend-infrastructure";
import { type Address, isAddress } from "viem";

/**
 * Resolves whether a wallet is granted platform-admin read-only access to
 * all merchants. The allow-list is parsed once (lazily) from
 * process.env.PLATFORM_ADMIN_WALLETS (comma-separated) into a memoized Set
 * of lowercased addresses.
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
     * Returns the configured platform-admin wallets (lowercased). Used during
     * merchant registration to co-admin the whole Frak team onto a merchant a
     * platform admin registers.
     */
    getAdminWallets(): Address[] {
        return [...this.getAdminSet()] as Address[];
    }
}
