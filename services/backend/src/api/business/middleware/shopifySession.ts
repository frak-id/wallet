import { verifyShopifySessionToken } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { ShopifySessionToken } from "../../../domain/auth/models/ShopifySessionDto";

export const shopifySessionContext = new Elysia({
    name: "Context.shopifySession",
})
    .guard({
        headers: t.Object({
            authorization: t.Optional(t.String()),
        }),
    })
    .resolve(async ({ headers }) => {
        const authHeader = headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return { shopifySession: null as ShopifySessionToken | null };
        }

        const token = authHeader.slice(7);
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
                    const authHeader = headers.authorization;
                    if (!authHeader?.startsWith("Bearer ")) {
                        set.headers["X-Shopify-Retry-Invalid-Session-Request"] =
                            "1";
                        return status(401, "Missing session token");
                    }

                    const token = authHeader.slice(7);
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
