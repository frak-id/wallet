/**
 * Function used to track the status of a purchase
 * when a purchase is tracked, the `purchaseCompleted` interactions will be automatically send for the user when we receive the purchase confirmation via webhook.
 *
 * @param args.customerId - The customer id that made the purchase (on your side)
 * @param args.orderId - The order id of the purchase (on your side)
 * @param args.token - The token of the purchase
 *
 * @description This function will send a request to the backend to listen for the purchase status.
 *
 * @example
 * async function trackPurchase(checkout) {
 *   const payload = {
 *     customerId: checkout.order.customer.id,
 *     orderId: checkout.order.id,
 *     token: checkout.token,
 *   };
 *
 *   await trackPurchaseStatus(payload);
 * }
 *
 * @remarks
 * - The `trackPurchaseStatus` function requires the `frak-wallet-interaction-token` stored in the session storage to authenticate the request.
 * - This function will print a warning if used in a non-browser environment or if the wallet interaction token is not available.
 */
export async function trackPurchaseStatus(args: {
    customerId: string | number;
    orderId: string | number;
    token: string;
}) {
    if (typeof window === "undefined") {
        console.warn("[Frak] No window found, can't track purchase");
        return;
    }
    const interactionToken = window.sessionStorage.getItem(
        "frak-wallet-interaction-token"
    );
    if (!interactionToken) {
        console.warn("[Frak] No frak session found, skipping purchase check");
        return;
    }

    // Submit the listening request
    await fetch("https://backend.frak.id/interactions/listenForPurchase", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-wallet-sdk-auth": interactionToken,
        },
        body: JSON.stringify(args),
    });
}
