import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Navigate } from "@tanstack/react-router";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { AffiliateConfigPanel } from "./AffiliateConfigPanel";

export function AffiliatePage({ merchantId }: { merchantId: string }) {
    const { data: merchant, isPending } = useMerchant({ merchantId });

    if (isPending) {
        return (
            <EditPageLayout merchantId={merchantId} page="affiliate">
                <Spinner />
            </EditPageLayout>
        );
    }

    // Non-affiliate merchants configure their SDK identity instead.
    if (!merchant?.affiliate) {
        return (
            <Navigate
                to="/m/$merchantId/merchant/customize"
                params={{ merchantId }}
                replace
            />
        );
    }

    return (
        <EditPageLayout merchantId={merchantId} page="affiliate">
            <AffiliateConfigPanel affiliate={merchant.affiliate} />
        </EditPageLayout>
    );
}
