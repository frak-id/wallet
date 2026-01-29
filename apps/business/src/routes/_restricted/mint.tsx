import { createFileRoute } from "@tanstack/react-router";
import { CriticalError } from "@/module/common/component/RouteError";
import { MintMerchant } from "@/module/dashboard/component/MintMerchant";

export const Route = createFileRoute("/_restricted/mint")({
    component: MintPage,
    errorComponent: CriticalError,
});

function MintPage() {
    return <MintMerchant />;
}
