/**
 * Function used to track the status of a purchase
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
