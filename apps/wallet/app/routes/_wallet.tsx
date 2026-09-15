import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ErrorFallback } from "@/module/common/component/ErrorBoundary";

export const Route = createFileRoute("/_wallet")({
    component: WalletLayout,
    // The only catch below root that fires when `AppShell` itself throws,
    // so the fallback here cannot lean on anything the shell provides.
    errorComponent: ErrorFallback,
});

function WalletLayout() {
    return <Outlet />;
}
