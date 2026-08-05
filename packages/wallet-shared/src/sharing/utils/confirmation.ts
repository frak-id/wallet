const SHARING_CONFIRMED_KEY = "frak_sharing_confirmed";
const CONFIRMATION_TTL_MS = 60 * 60 * 1000; // 1 hour

// One record, not one per merchant. A sharing page is only ever open for a
// single merchant at a time, so the store holds the most recent confirmation
// and `getSavedConfirmation` checks the merchant matches before honouring it.
// That is why `clearConfirmation` takes no merchant: there is only ever one
// record to clear, and clearing it for the merchant whose page is open is the
// same thing as clearing it outright.

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
 * Clear the saved confirmation.
 *
 * Takes no merchant on purpose — see the note at the top of this file: the
 * store holds exactly one record, so there is nothing to scope this to.
 */
export function clearConfirmation() {
    try {
        sessionStorage.removeItem(SHARING_CONFIRMED_KEY);
    } catch {
        // sessionStorage may not be available in some iframe contexts
    }
}
