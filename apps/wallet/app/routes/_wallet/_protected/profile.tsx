import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/profile")({
    component: ProfileLayout,
});

function ProfileLayout() {
    return <Outlet />;
}
