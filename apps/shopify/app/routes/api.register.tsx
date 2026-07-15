import { registerMerchant } from "app/services.server/backendMerchant";
import {
    clearMerchantCache,
    resolveMerchantId,
} from "app/services.server/merchant";
import { shopInfo } from "app/services.server/shop";
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * §4.12 inline embedded mint — replaces the old popup + setup-code flow.
 * Registers (or resolves, on a 409 race with another shop admin) the current
 * shop as a Frak merchant using the App Bridge session token as the sole
 * domain proof. No wallet, no DNS TXT record, no separate window.
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return data({ error: "Method not allowed" }, { status: 405 });
    }

    const context = await authenticate.admin(request);
    const shop = await shopInfo(context);

    const result = await registerMerchant(request, {
        name: shop.name,
        currency: shop.preferredCurrency,
        // Only meaningful when it differs from the myshopify domain — the
        // backend independently re-verifies the match before honoring it.
        primaryDomain:
            shop.domain !== shop.myshopifyDomain ? shop.domain : undefined,
    });

    await clearMerchantCache(context);

    if ("error" in result) {
        // A 409 (duplicate domain — another admin won the race, or a
        // re-install) is not a user-facing error: resolve the merchant that
        // already exists for this domain and report success (§4.12 edge
        // cases). Any other failure is surfaced as-is.
        const merchantId = await resolveMerchantId(context);
        if (merchantId) {
            return data({ merchantId });
        }
        return data({ error: result.error }, { status: 502 });
    }

    return data({ merchantId: result.merchantId });
}
