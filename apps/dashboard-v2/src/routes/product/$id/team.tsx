import { createFileRoute } from "@tanstack/react-router";
import type { Hex } from "viem";
import { requireAuth } from "@/middleware/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { Team } from "@/module/product/component/Team";

export const Route = createFileRoute("/product/$id/team")({
    beforeLoad: requireAuth,
    component: ProductTeamPage,
});

function ProductTeamPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <Breadcrumb current={"Team"} />
            <Team productId={id as Hex} />
        </RestrictedLayout>
    );
}
