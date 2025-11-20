import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { PageLoader } from "@/module/common/component/PageLoader";

export const Route = createFileRoute("/_wallet/_protected/wallet")({
    component: lazyRouteComponent(() =>
        import("@/module/wallet/page/WalletPage").then((m) => ({
            default: m.WalletPage,
        }))
    ),
    pendingComponent: PageLoader,
});
