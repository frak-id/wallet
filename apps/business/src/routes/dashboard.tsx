import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { MyProducts } from "@/module/dashboard/component/Products";

export const Route = createFileRoute("/dashboard")({
    beforeLoad: requireAuth,
    component: Dashboard,
});

function Dashboard() {
    return (
        <RestrictedLayout>
            <Head
                title={{ content: "Dashboard" }}
                leftSection={<Breadcrumb current={"Home"} />}
            />
            <MyProducts />
        </RestrictedLayout>
    );
}
