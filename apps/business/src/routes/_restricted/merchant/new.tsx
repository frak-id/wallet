import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/module/common/component/RouteError";
import { MerchantWizard } from "@/module/dashboard/component/MerchantWizard";

export const Route = createFileRoute("/_restricted/merchant/new")({
    staticData: { shell: "bare" },
    component: MerchantNewPage,
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Failed to Add Merchant"
            fallbackPath="/dashboard"
            fallbackLabel="Back to Dashboard"
        />
    ),
});

function MerchantNewPage() {
    return <MerchantWizard />;
}
