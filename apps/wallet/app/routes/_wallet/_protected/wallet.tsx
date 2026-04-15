import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/wallet")({
    component: WalletLayout,
});

function WalletLayout() {
    return <Outlet />;
}
