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
 * A second unauthenticated anonymousId oracle (narrower than
 * install-code/resolve since it also requires a valid checkoutToken, but
 * the same class of leak). Tightened from 30/min to 10/min — the
 * legitimate fallback fires once per real order, so this still leaves
 * headroom while cutting scan/enumeration throughput 3x.
 */
export const orderClientRoute = new Elysia()
    .use(
        rateLimitMiddleware({
            bucket: "identity-order-client",
            windowMs: 60_000,
            maxRequests: 10,
        })
    )
    .get(
        "/order-client",
        async ({ query }) => {
            const { merchantId, checkoutToken } = query;

            const webhook =
                await PurchasesContext.repositories.purchase.getWebhookByMerchantId(
                    merchantId
                );
            if (!webhook) {
                return status(404, "Merchant not found");
            }

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
