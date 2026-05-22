import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveActiveMerchant } from "@/module/common/utils/resolveActiveMerchant";

/**
 * Legacy redirect: `/campaigns/edit/$campaignId` → new tree.
 */
export const Route = createFileRoute("/_restricted/campaigns/edit/$campaignId")(
    {
        beforeLoad: async ({ params }) => {
            const resolved = await resolveActiveMerchant();
            if (resolved.status === "ok") {
                throw redirect({
                    to: "/m/$merchantId/campaigns/edit/$campaignId",
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
    }
);
