import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveActiveMerchant } from "@/module/common/utils/resolveActiveMerchant";

/**
 * Legacy redirect: `/campaigns/draft/$campaignId/validation` → new tree.
 */
export const Route = createFileRoute(
    "/_restricted/campaigns/draft/$campaignId/validation"
)({
    beforeLoad: async ({ params }) => {
        const resolved = await resolveActiveMerchant();
        if (resolved.status === "ok") {
            throw redirect({
                to: "/m/$merchantId/campaigns/draft/$campaignId/validation",
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
