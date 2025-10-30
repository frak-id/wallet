import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/product/$id/funding")({
    beforeLoad: requireAuth,
    component: ProductFundingPage,
});

function ProductFundingPage() {
    const { id } = Route.useParams();

    return (
        <RestrictedLayout>
            <Head
                title={{ content: "Product Funding" }}
                leftSection={<Breadcrumb current={"Funding"} />}
            />
            <div style={{ padding: "2rem" }}>
                <h2>Product Funding - Coming Soon</h2>
                <p>Product ID: {id}</p>
                <p>This page is under development.</p>
            </div>
        </RestrictedLayout>
    );
}
