import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser, settings }) => {
    const backendUrl = settings.backendUrl ?? "https://backend.frak.id";
    const settingsMerchantId = settings.merchantId;

    analytics.subscribe("checkout_completed", async (event) => {
        const interactionToken = await browser.sessionStorage.getItem(
            "frak-wallet-interaction-token"
        );
        const clientId = await browser.localStorage.getItem("frak-client-id");

        if (!interactionToken && !clientId) {
            return;
        }

        const merchantId =
            settingsMerchantId ||
            (await browser.sessionStorage.getItem("frak-merchant-id"));
        if (!merchantId) {
            console.log(
                "[FRAK] No merchantId available, skipping purchase tracking"
            );
            return;
        }

        const checkout = event.data.checkout;

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

        const payload = {
            customerId: checkout.order.customer.id,
            orderId: checkout.order.id,
            token: checkout.token,
            merchantId,
        };

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

        await fetch(`${backendUrl}/user/track/purchase`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            keepalive: true,
        });
    });
});
