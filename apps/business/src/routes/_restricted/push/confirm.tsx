import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveActiveMerchant } from "@/module/common/utils/resolveActiveMerchant";

/**
 * Legacy redirect: `/push/confirm` → `/m/$first/push/confirm`.
 */
export const Route = createFileRoute("/_restricted/push/confirm")({
    beforeLoad: async () => {
        const resolved = await resolveActiveMerchant();
        if (resolved.status === "ok") {
            throw redirect({
                to: "/m/$merchantId/push/confirm",
                params: { merchantId: resolved.merchant.id },
                replace: true,
            });
        }
        throw redirect({ to: "/dashboard", replace: true });
    },
    component: () => null,
});
