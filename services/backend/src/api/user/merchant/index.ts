import { Elysia, status, t } from "elysia";
import { MerchantContext } from "../../../domain/merchant/context";

export const userMerchantApi = new Elysia({ prefix: "/merchant" }).get(
    "/resolve",
    async ({ query: { domain } }) => {
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
            id: merchant.id,
            name: merchant.name,
            config: merchant.config,
        };
    },
    {
        query: t.Object({
            domain: t.String({ minLength: 1 }),
        }),
    }
);
