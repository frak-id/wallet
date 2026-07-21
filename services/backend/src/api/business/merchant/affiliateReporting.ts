import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    AffiliateReportingQuerySchema,
    AffiliateReportingResponseSchema,
    MerchantIdParamSchema,
} from "../../schemas";
import { businessSessionContext } from "../middleware/session";

/**
 * Platform-admin affiliate (TakeAds) reporting.
 *
 * Surfaces per-merchant clicks + actions stats pulled live from the TakeAds
 * Stats API. Guarded by `platformAdminAuthenticated` — the report exposes
 * cross-merchant provider data (revenue, commissions), so it's admin-only and
 * never rides the read-only platform-admin grant from `getMerchantPermissions`.
 */
export const merchantAffiliateReportingRoutes = new Elysia({
    prefix: "/:merchantId/affiliate",
})
    .use(businessSessionContext)
    .get(
        "/reporting",
        async ({ params: { merchantId }, query }) => {
            const report =
                await OrchestrationContext.orchestrators.affiliateReporting.getReport(
                    merchantId,
                    { from: query.from, to: query.to }
                );

            if (!report) {
                return status(
                    404,
                    "Merchant is not linked to an affiliate brand"
                );
            }

            return report;
        },
        {
            platformAdminAuthenticated: true,
            params: MerchantIdParamSchema,
            query: AffiliateReportingQuerySchema,
            response: {
                200: AffiliateReportingResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
