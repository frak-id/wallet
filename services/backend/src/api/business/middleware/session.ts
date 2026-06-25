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
    })
    .as("scoped");
