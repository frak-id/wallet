import { getBackendUrl } from "../utils/backendUrl";
import { getClientId } from "../utils/clientId";
import { fetchMerchantId } from "../utils/merchantId";

/**
 * Function used to track the status of a purchase
 * when a purchase is tracked, the `purchaseCompleted` interactions will be automatically send for the user when we receive the purchase confirmation via webhook.
 *
 * @param args.customerId - The customer id that made the purchase (on your side)
 * @param args.orderId - The order id of the purchase (on your side)
 * @param args.token - The token of the purchase
 * @param args.merchantId - Optional explicit merchant id to use for the tracking request
 *
 * @description This function will send a request to the backend to listen for the purchase status.
 *
 * @example
 * async function trackPurchase(checkout) {
 *   const payload = {
 *     customerId: checkout.order.customer.id,
 *     orderId: checkout.order.id,
 *     token: checkout.token,
 *     merchantId: "your-merchant-id",
 *   };
 *
 *   await trackPurchaseStatus(payload);
 * }
 *
 * @remarks
 * - Merchant id is resolved in this order: explicit `args.merchantId`, `frak-merchant-id` from session storage, then `fetchMerchantId()`.
 * - This function supports anonymous users and will use the `x-frak-client-id` header when available.
 * - At least one identity source must exist (`frak-wallet-interaction-token` or `x-frak-client-id`), otherwise the tracking request is skipped.
 * - This function will print a warning if used in a non-browser environment or if no identity / merchant id can be resolved.
 */
export async function trackPurchaseStatus(args: {
    customerId: string | number;
    orderId: string | number;
    token: string;
    merchantId?: string;
}) {
    if (typeof window === "undefined") {
        console.warn("[Frak] No window found, can't track purchase");
        return;
    }

    const interactionToken = window.sessionStorage.getItem(
        "frak-wallet-interaction-token"
    );

    const clientId = getClientId();
    if (!interactionToken && !clientId) {
        console.warn("[Frak] No identity found, skipping purchase check");
        return;
    }

    const merchantIdFromStorage =
        window.sessionStorage.getItem("frak-merchant-id");
    const merchantId =
        args.merchantId ?? merchantIdFromStorage ?? (await fetchMerchantId());

    if (!merchantId) {
        console.warn("[Frak] No merchant id found, skipping purchase check");
        return;
    }

    const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
    };

    if (interactionToken) {
        headers["x-wallet-sdk-auth"] = interactionToken;
    }

    if (clientId) {
        headers["x-frak-client-id"] = clientId;
    }

    // Submit the listening request
    const backendUrl = getBackendUrl();
    await fetch(`${backendUrl}/user/track/purchase`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            customerId: args.customerId,
            orderId: args.orderId,
            token: args.token,
            merchantId,
        }),
    });
}
