import { createFileRoute } from "@tanstack/react-router";
import { CriticalError } from "@/module/common/component/RouteError";
import { MintProduct } from "@/module/dashboard/component/MintProduct";

export const Route = createFileRoute("/_restricted/mint")({
    component: MintPage,
    errorComponent: CriticalError,
});

function MintPage() {
    return <MintProduct />;
}
