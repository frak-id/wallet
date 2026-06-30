import { createFileRoute, redirect } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantsPage } from "@/module/dashboard/component/MerchantsPage";
import { ManageBudgetSheet } from "@/module/merchant/component/ManageBudgetSheet";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/merchant/funding"
)({
    loader: async ({ params }) => {
        const demoMode = isDemoMode();
        const merchant = await queryClient.fetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
        // Platform admins are read-only and cannot fund — redirect away in the
        // route lifecycle rather than the component render body.
        if (merchant.role === "platform_admin") {
            throw redirect({
                to: "/m/$merchantId/dashboard",
                params: { merchantId: params.merchantId },
                replace: true,
            });
        }
    },
    component: MerchantFundingPage,
});

// Deep-link entry (bank status banner, merchant switcher): the merchant
// list renders as backdrop so the sheet matches its in-page trigger.
function MerchantFundingPage() {
    const { merchantId } = Route.useParams();
    const navigate = Route.useNavigate();
    const close = () =>
        navigate({
            to: "/m/$merchantId/dashboard",
            params: { merchantId },
            replace: true,
        });

    return (
        <>
            <MerchantsPage />
            <ManageBudgetSheet merchantId={merchantId} onClose={close} />
        </>
    );
}
