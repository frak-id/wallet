import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/recovery"
)({
    component: RecoveryLayout,
});

function RecoveryLayout() {
    return <Outlet />;
}
