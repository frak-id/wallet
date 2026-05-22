import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveActiveMerchant } from "@/module/common/utils/resolveActiveMerchant";

/**
 * Legacy redirect: `/campaigns/$campaignId` → `/m/$first/campaigns/$campaignId`.
 *
 * The destination route validates that the campaign actually belongs to
 * the merchant (returns 404 + redirects to list otherwise), so we just
 * pick the user's first merchant here. In practice this path is only hit
 * by old bookmarks / Shopify deep links built before the redesign.
 */
export const Route = createFileRoute("/_restricted/campaigns/$campaignId")({
    beforeLoad: async ({ params }) => {
        const resolved = await resolveActiveMerchant();
        if (resolved.status === "ok") {
            throw redirect({
                to: "/m/$merchantId/campaigns/$campaignId",
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
