import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { IdentityContext } from "../../../domain/identity/context";
import { PurchasesContext } from "../../../domain/purchases/context";

/**
 * Resolve the anonymous clientId for a purchase, given a merchantId
 * and either an orderId or a checkoutToken.
 *
 * Used by the Shopify post-purchase flow where the SDK isn't available
 * and the extension needs to resolve the clientId server-side.
 */
export const orderClientRoute = new Elysia().get(
    "/order-client",
    async ({ query }) => {
        const { merchantId, orderId, checkoutToken } = query;
        if (!orderId && !checkoutToken) {
            return status(400, "Either orderId or checkoutToken is required");
        }

        // Resolve webhookId from merchantId
        const webhook =
            await PurchasesContext.repositories.purchase.getWebhookByMerchantId(
                merchantId
            );
        if (!webhook) {
            return status(404, "Merchant not found");
        }

        // Find the purchase
        const purchase =
            await PurchasesContext.repositories.purchase.findByMerchantAndOrder({
                webhookId: webhook.id,
                orderId,
                checkoutToken,
            });
        if (!purchase?.identityGroupId) {
            return status(404, "Purchase not found");
        }

        // Resolve the anonymous fingerprint (clientId) from the identity group
        const clientId =
            await IdentityContext.repositories.identity.findAnonymousFingerprint(
                {
                    groupId: purchase.identityGroupId,
                    merchantId,
                }
            );
        if (!clientId) {
            return status(404, "Client not found");
        }

        return { clientId };
    },
    {
        query: t.Object({
            merchantId: t.String(),
            orderId: t.Optional(t.String()),
            checkoutToken: t.Optional(t.String()),
        }),
        response: {
            200: t.Object({
                clientId: t.String(),
            }),
            400: t.String(),
            404: t.String(),
        },
    }
);
