import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../domain/merchant";
import { MerchantIdParamSchema, SuccessResponseSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

const domainRegex =
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const merchantAllowedDomainsRoutes = new Elysia()
    .use(businessSessionContext)
    .post(
        "/:merchantId/allowed-domains",
        async ({
            params: { merchantId },
            body: { domain: rawDomain },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const domain =
                MerchantContext.repositories.dnsCheck.getNormalizedDomain(
                    rawDomain
                );
            if (!domainRegex.test(domain)) {
                return status(400, "Invalid domain format");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const updated =
                await MerchantContext.repositories.merchant.addAllowedDomain(
                    merchantId,
                    domain
                );
            if (!updated) {
                return status(404, "Merchant not found");
            }

            MerchantContext.services.resolve.invalidateForDomain(
                updated.domain
            );

            return { success: true };
        },
        {
            params: MerchantIdParamSchema,
            body: t.Object({
                domain: t.String({ minLength: 1 }),
            }),
            response: {
                200: SuccessResponseSchema,
                400: t.String(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .delete(
        "/:merchantId/allowed-domains",
        async ({
            params: { merchantId },
            body: { domain },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            const filtered = (merchant.allowedDomains ?? []).filter(
                (d) => d !== domain
            );

            await MerchantContext.repositories.merchant.setAllowedDomains(
                merchantId,
                filtered
            );

            MerchantContext.services.resolve.invalidateForDomain(
                merchant.domain
            );

            return { success: true };
        },
        {
            params: MerchantIdParamSchema,
            body: t.Object({
                domain: t.String({ minLength: 1 }),
            }),
            response: {
                200: SuccessResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
