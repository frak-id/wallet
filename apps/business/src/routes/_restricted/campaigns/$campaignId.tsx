import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveActiveMerchant } from "@/module/common/utils/resolveActiveMerchant";

/**
 * Legacy redirect: `/campaigns/$campaignId` → the merchant's campaigns list
 * with that campaign opened in the details sheet (`?campaign=<id>`).
 *
 * A stale/foreign campaign id simply leaves the sheet closed, so we just
 * pick the user's first merchant here. In practice this path is only hit
 * by old bookmarks / Shopify deep links built before the redesign.
 */
export const Route = createFileRoute("/_restricted/campaigns/$campaignId")({
    beforeLoad: async ({ params }) => {
        const resolved = await resolveActiveMerchant();
        if (resolved.status === "ok") {
            throw redirect({
                to: "/m/$merchantId/campaigns/list",
                params: { merchantId: resolved.merchant.id },
                search: { campaign: params.campaignId },
                replace: true,
            });
        }
        throw redirect({ to: "/dashboard", replace: true });
    },
    component: () => null,
});
