import {
    extractShopDomain,
    JwtContext,
    log,
    verifyShopifySessionToken,
} from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../domain/auth";
import type { ShopifySessionToken } from "../../../domain/auth/models/ShopifySessionDto";
import { MerchantContext } from "../../../domain/merchant";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

export const businessSessionContext = new Elysia({
    name: "Context.businessSession",
})
    .guard({
        headers: t.Object({
            "x-business-auth": t.Optional(t.String()),
            "x-shopify-session-token": t.Optional(t.String()),
        }),
    })
    .resolve(async ({ headers, request }) => {
        const businessAuth = headers["x-business-auth"];
        if (businessAuth) {
            const session = await JwtContext.business.verify(businessAuth);
            if (session) {
                return {
                    businessSession: session,
                    shopifySession: null as ShopifySessionToken | null,
                    hasMerchantAccess: async (merchantId: string) => {
                        if (
                            await MerchantContext.services.authorization.hasAccess(
                                merchantId,
                                session.wallet
                            )
                        )
                            return true;
                        if (
                            AuthContext.services.platformAdmin.isPlatformAdmin(
                                session.wallet
                            ) &&
                            SAFE_METHODS.has(request.method)
                        ) {
                            log.info(
                                {
                                    wallet: session.wallet,
                                    merchantId,
                                    method: request.method,
                                    path: request.url,
                                },
                                "platform-admin read-only access"
                            );
                            return true;
                        }
                        return false;
                    },
                };
            }
        }

        const shopifyToken = headers["x-shopify-session-token"];
        if (shopifyToken) {
            const session = await verifyShopifySessionToken(shopifyToken);
            if (session) {
                const shopDomain = extractShopDomain(session.dest);
                return {
                    businessSession: null,
                    shopifySession: session,
                    hasMerchantAccess: shopDomain
                        ? (merchantId: string) =>
                              MerchantContext.services.authorization.hasAccessByDomain(
                                  merchantId,
                                  shopDomain
                              )
                        : (_merchantId: string) =>
                              Promise.resolve(false as boolean),
                };
            }
        }

        return {
            businessSession: null,
            shopifySession: null as ShopifySessionToken | null,
            hasMerchantAccess: (_merchantId: string) =>
                Promise.resolve(false as boolean),
        };
    })
    .macro({
        businessAuthenticated(skip?: boolean) {
            if (skip) return;

            return {
                beforeHandle: async ({ headers, set }) => {
                    const businessAuth = headers["x-business-auth"];
                    if (businessAuth) {
                        const session =
                            await JwtContext.business.verify(businessAuth);
                        if (session) return;
                    }

                    const shopifyToken = headers["x-shopify-session-token"];
                    if (shopifyToken) {
                        const session =
                            await verifyShopifySessionToken(shopifyToken);
                        if (session) return;

                        set.headers["X-Shopify-Retry-Invalid-Session-Request"] =
                            "1";
                    }

                    return status(
                        401,
                        "Unauthorized - No valid authentication"
                    );
                },
            };
        },
        /**
         * Platform-admin-only guard for billing admin mutation routes
         * (deposits/withdrawals/monthly-bills). Deliberately independent from
         * `hasMerchantAccess`, whose platform-admin bypass is read-only /
         * safe-methods-only and must never authorize mutations. The Shopify
         * session path has no wallet and is always rejected here.
         */
        platformAdminAuthenticated(skip?: boolean) {
            if (skip) return;

            return {
                beforeHandle: async ({ headers }) => {
                    const businessAuth = headers["x-business-auth"];
                    if (!businessAuth) {
                        return status(401, "Unauthorized");
                    }

                    const session =
                        await JwtContext.business.verify(businessAuth);
                    if (!session) {
                        return status(401, "Unauthorized");
                    }

                    if (
                        !AuthContext.services.platformAdmin.isPlatformAdmin(
                            session.wallet
                        )
                    ) {
                        return status(403, "Platform admin access required");
                    }
                },
            };
        },
    })
    .as("scoped");
