import { log } from "@backend-infrastructure";
import { isAddress } from "viem";
import type { Address } from "viem";

/**
 * Lazily-parsed, memoized Set of lowercased wallet addresses that are
 * granted platform-admin read-only access to all merchants.
 * Populated from process.env.PLATFORM_ADMIN_WALLETS (comma-separated).
 * Re-set to null on module reset / test teardown via resetForTesting().
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

/** Reset memoized cache — for use in unit tests only. */
export function _resetPlatformAdminCache(): void {
    _cache = null;
}
