import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { requireAuth } from "@/middleware/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { ProductSetupStatus } from "@/module/product/component/SetupStatus";

export const Route = createFileRoute("/product/$id/setup-status")({
    beforeLoad: requireAuth,
    component: ProductSetupStatusPage,
});

function ProductSetupStatusPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <Breadcrumb current={"Setup Status"} />
            <ProductSetupStatus productId={id as Hex} />
        </RestrictedLayout>
    );
}
