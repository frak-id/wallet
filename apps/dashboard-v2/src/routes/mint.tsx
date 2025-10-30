import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/mint")({
    beforeLoad: requireAuth,
    component: MintPage,
});

function MintPage() {
    return (
        <RestrictedLayout>
            <Head
                title={{ content: "List a Product" }}
                leftSection={<Breadcrumb current={"List Product"} />}
            />
            <div style={{ padding: "2rem" }}>
                <h2>List a Product - Coming Soon</h2>
                <p>This page is under development.</p>
            </div>
        </RestrictedLayout>
    );
}
