import type { FrakClient } from "../../types";
import { referralInteraction } from "./referralInteraction";

/**
 * Custom event name dispatched on successful referral processing.
 *
 * Fired once per page load when a valid referral context is found in the URL
 * and successfully tracked. Consumers (e.g. `<frak-banner>`) listen for this
 * to display a referral success message.
 */
export const REFERRAL_SUCCESS_EVENT = "frak:referral-success";

/**
 * Process referral context and emit a DOM event on success.
 *
 * - Calls {@link referralInteraction} to detect and track any referral in the URL
 * - On `"success"`, dispatches a bare {@link REFERRAL_SUCCESS_EVENT} on `window`
 * - Silently swallows errors (fire-and-forget during SDK init)
 *
 * @param client - The initialized Frak client
 */
export async function setupReferral(client: FrakClient): Promise<void> {
    try {
        const state = await referralInteraction(client);

        if (state === "success") {
            window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));
        }
    } catch (error) {
        console.warn("[Frak] Referral setup failed", error);
    }
}
