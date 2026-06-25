import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { isDemoMode } from "@/config/auth";
import { queryClient } from "@/module/common/provider/RootProvider";
import { MerchantsPage } from "@/module/dashboard/component/MerchantsPage";
import { ManageBudgetSheet } from "@/module/merchant/component/ManageBudgetSheet";
import { useReadOnlyMerchant } from "@/module/merchant/hook/useReadOnlyMerchant";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/merchant/funding"
)({
    loader: ({ params }) => {
        const demoMode = isDemoMode();
        queryClient.prefetchQuery(
            merchantQueryOptions(params.merchantId, demoMode)
        );
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
    const isReadOnly = useReadOnlyMerchant({ merchantId });

    // Platform admins cannot fund — redirect to the merchant dashboard.
    useEffect(() => {
        if (isReadOnly) close();
    }, [isReadOnly]);

    if (isReadOnly) return <MerchantsPage />;

    return (
        <>
            <MerchantsPage />
            <ManageBudgetSheet merchantId={merchantId} onClose={close} />
        </>
    );
}
