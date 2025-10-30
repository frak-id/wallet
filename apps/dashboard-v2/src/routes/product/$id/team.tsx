import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/product/$id/team")({
    beforeLoad: requireAuth,
    component: ProductTeamPage,
});

function ProductTeamPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <Head
                title={{ content: "Team Management" }}
                leftSection={<Breadcrumb current={"Team"} />}
            />
            <div style={{ padding: "2rem" }}>
                <h2>Team Management - Coming Soon</h2>
                <p>Product ID: {id}</p>
                <p>This page is under development.</p>
            </div>
        </RestrictedLayout>
    );
}
