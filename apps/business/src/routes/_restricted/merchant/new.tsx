import { createFileRoute } from "@tanstack/react-router";
import { MerchantCreateError } from "@/module/common/component/RouteError";
import { MerchantWizard } from "@/module/dashboard/component/MerchantWizard";

export const Route = createFileRoute("/_restricted/merchant/new")({
    staticData: { shell: "bare" },
    component: MerchantNewPage,
    errorComponent: MerchantCreateError,
});

function MerchantNewPage() {
    return <MerchantWizard />;
}
