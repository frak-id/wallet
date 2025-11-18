import { createFileRoute } from "@tanstack/react-router";
import { MintProduct } from "@/module/dashboard/component/MintProduct";

export const Route = createFileRoute("/_restricted/mint")({
    component: MintPage,
});

function MintPage() {
    return <MintProduct />;
}
