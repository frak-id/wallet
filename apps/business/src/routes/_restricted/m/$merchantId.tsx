import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "@/config/auth";
import { useIsBareShell } from "@/module/common/hook/useIsBareShell";
import { queryClient } from "@/module/common/provider/RootProvider";
import { BankStatusBanner } from "@/module/merchant/component/BankStatusBanner";
import { useReadOnlyMerchant } from "@/module/merchant/hook/useReadOnlyMerchant";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";
import { activeMerchantStore } from "@/stores/activeMerchantStore";
import * as styles from "./$merchantId.css";

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

        // Platform admins can reach any merchant via allMerchants
        if (data.isPlatformAdmin) {
            const allMerchants = data.allMerchants ?? [];
            const found =
                all.find((m) => m.id === params.merchantId) ??
                allMerchants.find((m) => m.id === params.merchantId);
            if (found) return { merchant: found };
            // Intentional stub: platform admins can deep-link to any merchantId
            // (e.g. from a support ticket). The stub lets the route render;
            // the downstream merchant query resolves the real data or 404s if
            // the id is truly invalid.
            return {
                merchant: { id: params.merchantId, name: "", domain: "" },
            };
        }

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

function PlatformAdminBanner({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const isReadOnly = useReadOnlyMerchant({ merchantId });
    if (!isReadOnly) return null;
    return (
        <div
            role="status"
            aria-live="polite"
            className={styles.platformAdminBanner}
        >
            {t("platformAdmin.readOnlyBanner", {
                defaultValue:
                    "Read-only platform-admin view — editing disabled",
            })}
        </div>
    );
}

function MerchantLayout() {
    const { merchantId } = Route.useParams();
    // Remember this as the merchant the user is working in, so param-less
    // routes (settings, legacy `/dashboard`) stay on it.
    useEffect(() => {
        activeMerchantStore.getState().setLastMerchantId(merchantId);
    }, [merchantId]);
    // Bare-shell pages (campaign wizard, merchant edit) are immersive
    // full-viewport layouts — the global bank banner would collide with
    // their own toolbars. Hide it there.
    const isBareShell = useIsBareShell();
    return (
        <>
            <PlatformAdminBanner merchantId={merchantId} />
            {!isBareShell && <BankStatusBanner merchantId={merchantId} />}
            <Outlet />
        </>
    );
}
