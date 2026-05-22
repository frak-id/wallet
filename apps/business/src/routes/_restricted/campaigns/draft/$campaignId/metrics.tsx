import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveActiveMerchant } from "@/module/common/utils/resolveActiveMerchant";

/**
 * Legacy redirect: `/campaigns/draft/$campaignId/metrics` → new tree.
 */
export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/metrics"
)({
    beforeLoad: async ({ params }) => {
        const resolved = await resolveActiveMerchant();
        if (resolved.status === "ok") {
            throw redirect({
                to: "/m/$merchantId/campaigns/draft/$campaignId/metrics",
                params: {
                    merchantId: resolved.merchant.id,
                    campaignId: params.campaignId,
                },
                replace: true,
            });
        }
        throw redirect({ to: "/dashboard", replace: true });
    },
    component: () => null,
});
