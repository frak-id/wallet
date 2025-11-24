import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet")({
    component: WalletLayout,
});

function WalletLayout() {
    return <Outlet />;
}
