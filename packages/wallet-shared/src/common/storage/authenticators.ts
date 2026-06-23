import { createStore, get, set } from "idb-keyval";
import type { Address } from "viem";
import type { PreviousAuthenticatorModel } from "./PreviousAuthenticatorModel";

// Custom store: database "frak-wallet", store "authenticators"
const authenticatorStore = createStore("frak-wallet", "authenticators");
const AUTHENTICATORS_KEY = "previous-authenticators";

/**
 * Lightweight authenticator storage using idb-keyval
 * Database: frak-wallet, Store: authenticators
 */
export const authenticatorStorage = {
    /**
     * Add or update an authenticator
     * Uses wallet address as primary key (replaces existing entry)
     */
    async put(authenticator: PreviousAuthenticatorModel): Promise<void> {
        const existing =
            (await get<PreviousAuthenticatorModel[]>(
                AUTHENTICATORS_KEY,
                authenticatorStore
            )) || [];
        // Remove existing entry for this wallet (primary key behavior)
        const filtered = existing.filter(
            (a) => a.wallet !== authenticator.wallet
        );
        filtered.push(authenticator);
        await set(AUTHENTICATORS_KEY, filtered, authenticatorStore);
    },

    /**
     * Drop every entry bound to a given wallet address. Used by the merge
     * flow to evict the orphaned loser-wallet row — `put` dedupes by the
     * NEW wallet key, so without an explicit removal the loser address
     * would linger in the previous-authenticators list forever and the
     * recovery picker would offer logins to a wallet that no longer exists.
     */
    async remove(wallet: Address): Promise<void> {
        try {
            const existing = await get<PreviousAuthenticatorModel[]>(
                AUTHENTICATORS_KEY,
                authenticatorStore
            );
            if (!existing) return;
            const filtered = existing.filter((a) => a.wallet !== wallet);
            if (filtered.length === existing.length) return;
            await set(AUTHENTICATORS_KEY, filtered, authenticatorStore);
        } catch (err) {
            if (err instanceof DOMException && err.name === "NotFoundError") {
                return;
            }
            console.error("Failed to remove authenticator:", err);
        }
    },

    /**
     * Get all authenticators
     */
    async getAll(): Promise<PreviousAuthenticatorModel[]> {
        try {
            return (
                (await get<PreviousAuthenticatorModel[]>(
                    AUTHENTICATORS_KEY,
                    authenticatorStore
                )) || []
            );
        } catch (err) {
            // If store doesn't exist yet (no writes have been made), return empty array
            if (err instanceof DOMException && err.name === "NotFoundError") {
                return [];
            }
            // Log unexpected errors for debugging
            console.error("Failed to get authenticators:", err);
            return [];
        }
    },
};
