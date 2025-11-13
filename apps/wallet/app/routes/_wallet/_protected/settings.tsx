import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/settings")({
    component: SettingsLayout,
});

function SettingsLayout() {
    return <Outlet />;
}
