import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { MintProduct } from "@/module/dashboard/component/MintProduct";

export const Route = createFileRoute("/mint")({
    beforeLoad: requireAuth,
    component: MintPage,
});

function MintPage() {
    return (
        <RestrictedLayout>
            <MintProduct />
        </RestrictedLayout>
    );
}
