/**
 * Client ID utilities for anonymous tracking
 * Generates and persists a UUID fingerprint for referral attribution
 */

const CLIENT_ID_KEY = "frak-client-id";

/**
 * Generate a UUID v4
 * Uses crypto.randomUUID if available, otherwise falls back to a manual implementation
 */
function generateUUID(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Get the client ID from localStorage, creating one if it doesn't exist
 * @returns The client ID (UUID format)
 */
export function getClientId(): string {
    if (typeof window === "undefined" || !window.localStorage) {
        // SSR or no localStorage - generate ephemeral ID
        console.warn(
            "[Frak SDK] No Window / localStorage available to save the clientId"
        );
        return generateUUID();
    }

    let clientId = localStorage.getItem(CLIENT_ID_KEY);
    if (!clientId) {
        clientId = generateUUID();
        localStorage.setItem(CLIENT_ID_KEY, clientId);
    }
    return clientId;
}
