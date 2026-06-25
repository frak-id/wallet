import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import { isAddress } from "viem";

/**
 * Lazily-parsed, memoized Set of lowercased wallet addresses that are
 * granted platform-admin read-only access to all merchants.
 * Populated from process.env.PLATFORM_ADMIN_WALLETS (comma-separated).
 */
let _cache: Set<string> | null = null;

function getAdminSet(): Set<string> {
    if (_cache !== null) return _cache;

    const raw = process.env.PLATFORM_ADMIN_WALLETS ?? "";
    const set = new Set<string>();

    if (!raw.trim()) {
        _cache = set;
        return set;
    }

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

    _cache = set;
    return set;
}

export function isPlatformAdmin(wallet: Address): boolean {
    return getAdminSet().has(wallet.toLowerCase());
}
