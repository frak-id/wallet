import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser }) => {
    // Sample subscribe to the checkout completed event
    analytics.subscribe("checkout_completed", async (event) => {
        const interactionToken = await browser.sessionStorage.getItem(
            "frak-wallet-interaction-token"
        );
        if (!interactionToken) {
            return;
        }

        const checkout = event.data.checkout;

        // Check if we got all the right fields
        if (
            !(
                checkout.order?.customer?.id &&
                checkout.order?.id &&
                checkout.token
            )
        ) {
            console.log("[FRAK] Missing required fields in checkout data");
            return;
        }

        // Build the payload and send it
        const payload = {
            customerId: checkout.order.customer.id,
            orderId: checkout.order.id,
            token: checkout.token,
        };

        await fetch("https://backend.frak.id/interactions/listenForPurchase", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-wallet-sdk-auth": interactionToken,
            },
            body: JSON.stringify(payload),
            keepalive: true,
        });
    });
});
