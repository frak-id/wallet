import { HttpError, t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../domain/merchant";
import { MerchantIdParamSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

const domainRegex =
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const merchantAllowedDomainsRoutes = new Elysia()
    .use(businessSessionContext)
    .post(
        "/:merchantId/allowed-domains",
        async ({ params: { merchantId }, body: { domain: rawDomain } }) => {
            const domain =
                MerchantContext.repositories.dnsCheck.getNormalizedDomain(
                    rawDomain
                );
            if (!domainRegex.test(domain)) {
                // Same code the normalization above throws, so both rejection
                // paths look identical to a client.
                throw HttpError.badRequest(
                    "INVALID_DOMAIN",
                    `Invalid domain: "${rawDomain}"`
                );
            }

            // Resolution picks the first merchant holding the domain (primary
            // `domain` first, then `allowedDomains`), so letting two claim one
            // domain would make its resolve result arbitrary.
            const owner =
                (await MerchantContext.repositories.merchant.findByDomain(
                    domain
                )) ??
                (await MerchantContext.repositories.merchant.findByAllowedDomain(
                    domain
                ));
            if (owner && owner.id !== merchantId) {
                throw HttpError.conflict(
                    "DOMAIN_ALREADY_CLAIMED",
                    `Domain "${domain}" is already claimed by another merchant`
                );
            }

            const updated =
                await MerchantContext.repositories.merchant.addAllowedDomain(
                    merchantId,
                    domain
                );
            if (!updated) {
                return status(404, "Merchant not found");
            }

            MerchantContext.services.resolve.invalidateForMerchant(updated);

            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                domain: t.String({ minLength: 1 }),
            }),
            response: {
                204: t.Void(),
                400: t.ErrorResponse,
                401: t.String(),
                403: t.String(),
                404: t.String(),
                409: t.ErrorResponse,
            },
        }
    )
    .delete(
        "/:merchantId/allowed-domains",
        async ({ params: { merchantId }, body: { domain } }) => {
            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            // Entries are stored normalized, so the raw body has to go through
            // the same normalization or removing "www.example.com" silently
            // no-ops. Invalid input cannot match anything, so drop the 400 and
            // let the filter be a no-op.
            let normalized: string;
            try {
                normalized =
                    MerchantContext.repositories.dnsCheck.getNormalizedDomain(
                        domain
                    );
            } catch {
                normalized = domain;
            }

            const filtered = (merchant.allowedDomains ?? []).filter(
                (d) => d !== normalized && d !== domain
            );

            await MerchantContext.repositories.merchant.setAllowedDomains(
                merchantId,
                filtered
            );

            MerchantContext.services.resolve.invalidateForMerchant(merchant);

            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                domain: t.String({ minLength: 1 }),
            }),
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
