import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveActiveMerchant } from "@/module/common/utils/resolveActiveMerchant";

/**
 * Legacy redirect: `/campaigns/performance` → `/m/$first/campaigns/performance`.
 */
export const Route = createFileRoute("/_restricted/campaigns/performance")({
    beforeLoad: async () => {
        const resolved = await resolveActiveMerchant();
        if (resolved.status === "ok") {
            throw redirect({
                to: "/m/$merchantId/campaigns/performance",
                params: { merchantId: resolved.merchant.id },
                replace: true,
            });
        }
        throw redirect({ to: "/dashboard", replace: true });
    },
    component: () => null,
});
