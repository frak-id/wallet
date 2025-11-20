import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/wallet")({
    component: lazyRouteComponent(
        () => import("@/module/wallet/page/WalletPage"),
        "WalletPage"
    ),
});
