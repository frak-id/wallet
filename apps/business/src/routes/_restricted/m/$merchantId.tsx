import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { useIsBareShell } from "@/module/common/hook/useIsBareShell";
import { queryClient } from "@/module/common/provider/RootProvider";
import { BankStatusBanner } from "@/module/merchant/component/BankStatusBanner";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";

/**
 * Layout route that gates every `/m/$merchantId/...` page on the user
 * having access to the requested merchant.
 *
 * - Prefetches `myMerchants` so the switcher and child queries stay fast.
 * - Redirects to the first available merchant when `merchantId` is
 *   unknown or no longer accessible (owner first, admin-of fallback).
 * - Redirects to `/dashboard` (handled by the legacy redirect route)
 *   when the user has zero merchants — that page surfaces onboarding.
 */
export const Route = createFileRoute("/_restricted/m/$merchantId")({
    beforeLoad: async ({ params }) => {
        const data = await queryClient.ensureQueryData(
            myMerchantsQueryOptions(isDemoMode())
        );

        const owned = data.owned ?? [];
        const adminOf = data.adminOf ?? [];
        const all = [...owned, ...adminOf];

        if (all.length === 0) {
            // Let the dashboard legacy redirect handle the empty state.
            throw redirect({ to: "/dashboard" });
        }

        const found = all.find((m) => m.id === params.merchantId);
        if (!found) {
            const fallback = owned[0] ?? adminOf[0];
            throw redirect({
                to: "/m/$merchantId/dashboard",
                params: { merchantId: fallback.id },
                replace: true,
            });
        }

        return { merchant: found };
    },
    component: MerchantLayout,
});

function MerchantLayout() {
    const { merchantId } = Route.useParams();
    // Bare-shell pages (campaign wizard, merchant edit) are immersive
    // full-viewport layouts — the global bank banner would collide with
    // their own toolbars. Hide it there.
    const isBareShell = useIsBareShell();
    return (
        <>
            {!isBareShell && <BankStatusBanner merchantId={merchantId} />}
            <Outlet />
        </>
    );
}
