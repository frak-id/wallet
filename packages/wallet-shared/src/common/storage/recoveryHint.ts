import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import type { Address } from "viem";

/**
 * Minimal hint persisted in platform-native cloud storage so that the wallet
 * can offer a smoother UX after an uninstall/reinstall or device migration.
 *
 * Backed by:
 *  - iOS: `NSUbiquitousKeyValueStore` (iCloud KV) with an iCloud Keychain
 *    fallback — see `tauri-plugin-recovery-hint`.
 *  - Android: Google Block Store with `shouldBackupToCloud = true`.
 *  - Web / desktop: no-op (returns an empty hint).
 *
 * Keep the payload tiny — iCloud KV caps values at 1 KB. We only store what
 * we strictly need to drive the recovery flow or skip registration.
 */
export type RecoveryHint = {
    lastAuthenticatorId?: string;
    lastWallet?: Address;
    lastLoginAt?: number;
};

const INVOKE_GET = "plugin:recovery-hint|get_recovery_hint";
const INVOKE_SET = "plugin:recovery-hint|set_recovery_hint";
const INVOKE_CLEAR = "plugin:recovery-hint|clear_recovery_hint";

async function tauriInvoke<T>(cmd: string, args?: unknown): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args as Record<string, unknown> | undefined);
}

export const recoveryHintStorage = {
    /**
     * Read the last recovery hint. Returns an empty object on non-Tauri
     * platforms or when nothing has been persisted yet.
     */
    async get(): Promise<RecoveryHint> {
        if (!isTauri()) return {};
        try {
            return await tauriInvoke<RecoveryHint>(INVOKE_GET);
        } catch (err) {
            console.warn("recoveryHintStorage.get failed", err);
            return {};
        }
    },

    /**
     * Merge + persist a recovery hint. Missing fields are left untouched so
     * callers can update a single field without re-reading the whole hint.
     */
    async set(hint: RecoveryHint): Promise<void> {
        if (!isTauri()) return;
        try {
            const current = await recoveryHintStorage.get();
            const merged: RecoveryHint = { ...current, ...hint };
            await tauriInvoke<void>(INVOKE_SET, { hint: merged });
        } catch (err) {
            console.warn("recoveryHintStorage.set failed", err);
        }
    },

    /**
     * Remove any persisted hint. Typically called on explicit logout.
     */
    async clear(): Promise<void> {
        if (!isTauri()) return;
        try {
            await tauriInvoke<void>(INVOKE_CLEAR);
        } catch (err) {
            console.warn("recoveryHintStorage.clear failed", err);
        }
    },
};
