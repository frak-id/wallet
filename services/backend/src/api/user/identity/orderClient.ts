import { rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { IdentityContext } from "../../../domain/identity/context";
import { PurchasesContext } from "../../../domain/purchases/context";

/**
 * Resolve the anonymous clientId for a purchase, given a merchantId
 * and a checkoutToken.
 *
 * Used by the Shopify post-purchase flow as a fallback when the
 * `_frak-client-id` cart attribute is missing.
 */
export const orderClientRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 30 }))
    .get(
        "/order-client",
        async ({ query }) => {
            const { merchantId, checkoutToken } = query;

            // Resolve webhookId from merchantId
            const webhook =
                await PurchasesContext.repositories.purchase.getWebhookByMerchantId(
                    merchantId
                );
            if (!webhook) {
                return status(404, "Merchant not found");
            }

            // Find the purchase by checkout token
            const purchase =
                await PurchasesContext.repositories.purchase.findByMerchantAndCheckoutToken(
                    {
                        webhookId: webhook.id,
                        checkoutToken,
                    }
                );
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
                checkoutToken: t.String(),
            }),
            response: {
                200: t.Object({
                    clientId: t.String(),
                }),
                404: t.String(),
            },
        }
    );
