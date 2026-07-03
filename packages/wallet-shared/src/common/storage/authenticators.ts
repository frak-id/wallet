import { areAddressesEqual } from "@frak-labs/core-sdk";
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
        // Remove existing entry for this wallet (primary key behavior).
        // Address comparison must be case-insensitive: different write paths
        // persist different casings (checksummed vs lowercase) of the same
        // address, and a raw string compare duplicated the row instead of
        // replacing it.
        const filtered = existing.filter(
            (a) => !areAddressesEqual(a.wallet, authenticator.wallet)
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
            // Case-insensitive: must also evict rows persisted with a
            // different casing of the same address (see `put`).
            const filtered = existing.filter(
                (a) => !areAddressesEqual(a.wallet, wallet)
            );
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
