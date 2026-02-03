import type { FrakClient } from "../types";
import type { SendInteractionParamsType } from "../types/rpc/interaction";

/**
 * Send an interaction to the backend via the listener RPC.
 * Fire-and-forget: errors are caught and logged, not thrown.
 *
 * @param client - The Frak client instance
 * @param params - The interaction parameters
 */
export async function sendInteraction(
    client: FrakClient,
    params: SendInteractionParamsType
): Promise<void> {
    try {
        await client.request({
            method: "frak_sendInteraction",
            params: [params],
        });
    } catch {
        // Silent failure - fire-and-forget
        console.warn("[Frak SDK] Failed to send interaction:", params.type);
    }
}
