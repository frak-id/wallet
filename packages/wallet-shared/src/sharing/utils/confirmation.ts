const SHARING_CONFIRMED_KEY = "frak_sharing_confirmed";
const CONFIRMATION_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if a sharing confirmation was saved within the TTL for this merchant.
 */
export function getSavedConfirmation(merchantId: string): boolean {
    try {
        const raw = sessionStorage.getItem(SHARING_CONFIRMED_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw) as {
            merchantId: string;
            timestamp: number;
        };
        return (
            saved.merchantId === merchantId &&
            Date.now() - saved.timestamp < CONFIRMATION_TTL_MS
        );
    } catch {
        return false;
    }
}

/**
 * Save a sharing confirmation to sessionStorage.
 */
export function saveConfirmation(merchantId: string) {
    try {
        sessionStorage.setItem(
            SHARING_CONFIRMED_KEY,
            JSON.stringify({ merchantId, timestamp: Date.now() })
        );
    } catch {
        // sessionStorage may not be available in some iframe contexts
    }
}

/**
 * Clear the sharing confirmation from sessionStorage.
 */
export function clearConfirmation() {
    try {
        sessionStorage.removeItem(SHARING_CONFIRMED_KEY);
    } catch {
        // sessionStorage may not be available in some iframe contexts
    }
}
