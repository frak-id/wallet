import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/module/common/component/AppShell";

export const Route = createFileRoute("/_wallet/_sso")({
    component: SsoLayout,
});

function SsoLayout() {
    return (
        <AppShell>
            <Outlet />
        </AppShell>
    );
}
