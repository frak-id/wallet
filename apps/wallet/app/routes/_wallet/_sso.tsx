import { createFileRoute, Outlet } from "@tanstack/react-router";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";

export const Route = createFileRoute("/_wallet/_sso")({
    component: SsoLayout,
});

function SsoLayout() {
    return (
        <GlobalLayout header={false}>
            <Outlet />
        </GlobalLayout>
    );
}
