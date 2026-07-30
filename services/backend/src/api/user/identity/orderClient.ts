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
 *
 * README §3.4: a second unauthenticated anonymousId oracle (narrower than
 * install-code/resolve since it additionally requires a valid
 * `checkoutToken`, but the same class of leak). Tightened from 30/min to
 * 10/min — the legitimate Shopify post-purchase fallback fires once per
 * real order, so this still leaves comfortable headroom while cutting
 * scan/enumeration throughput 3x. Same in-memory-per-pod caveat as §3.3.
 */
export const orderClientRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
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
