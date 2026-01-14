import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../domain/merchant";

/**
 * Public merchant API routes
 * Used by SDK for merchantId resolution from domain
 */
export const merchantApi = new Elysia({ prefix: "/merchant" }).get(
    "/by-domain",
    async ({ query }) => {
        const { domain } = query;

        // Normalize domain (lowercase, no protocol, no trailing slash)
        const normalizedDomain = domain
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/$/, "");

        const merchant =
            await MerchantContext.repositories.merchant.findByDomain(
                normalizedDomain
            );

        if (!merchant) {
            return status(404, { error: "Merchant not found" });
        }

        return {
            merchantId: merchant.id,
            productId: merchant.productId,
            name: merchant.name,
            domain: merchant.domain,
        };
    },
    {
        query: t.Object({
            domain: t.String({ minLength: 1 }),
        }),
        response: {
            200: t.Object({
                merchantId: t.String(),
                productId: t.Union([t.Hex(), t.Null()]),
                name: t.String(),
                domain: t.String(),
            }),
            404: t.Object({
                error: t.String(),
            }),
        },
    }
);
