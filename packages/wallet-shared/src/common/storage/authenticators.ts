import { createStore, get, set } from "idb-keyval";
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
