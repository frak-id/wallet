import { verifyShopifySessionToken } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { ShopifySessionToken } from "../../../domain/auth/models/ShopifySessionDto";

export const shopifySessionContext = new Elysia({
    name: "Context.shopifySession",
})
    .guard({
        headers: t.Object({
            "x-shopify-session-token": t.Optional(t.String()),
        }),
    })
    .resolve(async ({ headers }) => {
        const token = headers["x-shopify-session-token"];
        if (!token) {
            return { shopifySession: null as ShopifySessionToken | null };
        }

        const session = await verifyShopifySessionToken(token);
        return {
            shopifySession: session,
        };
    })
    .macro({
        shopifyAuthenticated(skip?: boolean) {
            if (skip) return;

            return {
                beforeHandle: async ({ headers, set }) => {
                    const token = headers["x-shopify-session-token"];
                    if (!token) {
                        set.headers["X-Shopify-Retry-Invalid-Session-Request"] =
                            "1";
                        return status(401, "Missing session token");
                    }

                    const session = await verifyShopifySessionToken(token);
                    if (!session) {
                        set.headers["X-Shopify-Retry-Invalid-Session-Request"] =
                            "1";
                        return status(401, "Invalid session token");
                    }
                },
            };
        },
    })
    .as("scoped");
