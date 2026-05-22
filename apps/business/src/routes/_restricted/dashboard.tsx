import { Button } from "@frak-labs/design-system/components/Button";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Head } from "@/module/common/component/Head";
import { resolveActiveMerchant } from "@/module/common/utils/resolveActiveMerchant";
import { AddMerchantSheet } from "@/module/dashboard/component/AddMerchantSheet";

/**
 * Dual-purpose `/dashboard` route:
 *
 * 1. When the user has at least one merchant, redirects to
 *    `/m/$first/dashboard`. This keeps legacy bookmarks and Shopify
 *    deep links working while every workspace view lives under the new
 *    `/m/$merchantId/...` tree.
 * 2. When the user has no merchants, renders an explicit onboarding
 *    empty state so users with a brand-new account aren't dropped onto
 *    a blank page.
 */
export const Route = createFileRoute("/_restricted/dashboard")({
    beforeLoad: async () => {
        const resolved = await resolveActiveMerchant();
        if (resolved.status === "ok") {
            throw redirect({
                to: "/m/$merchantId/dashboard",
                params: { merchantId: resolved.merchant.id },
                replace: true,
            });
        }
    },
    component: OnboardingDashboard,
});

function OnboardingDashboard() {
    const { t } = useTranslation();
    return (
        <>
            <Head title={{ content: t("shell.nav.dashboard") }} />
            <EmptyState
                title={t("dashboard.empty.title")}
                description={t("dashboard.empty.description")}
            />
            <AddMerchantSheet
                trigger={
                    <Button variant="primary">
                        <Plus size={16} />
                        {t("shell.header.addMerchant")}
                    </Button>
                }
            />
        </>
    );
}
