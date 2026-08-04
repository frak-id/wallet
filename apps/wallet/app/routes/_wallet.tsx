import { createFileRoute, Outlet } from "@tanstack/react-router";
import { EnsureConflictToast } from "@/module/pending-actions/component/EnsureConflictToast";

export const Route = createFileRoute("/_wallet")({
    component: WalletLayout,
});

function WalletLayout() {
    return (
        <>
            <EnsureConflictToast />
            <Outlet />
        </>
    );
}
