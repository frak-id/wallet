import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Header } from "@/module/common/component/Header";
import { Navigation } from "@/module/common/component/Navigation";
import { useIsBareShell } from "@/module/common/hook/useIsBareShell";
import "@/styles/restricted.css";
import { main } from "./_restricted.css";

export const Route = createFileRoute("/_restricted")({
    beforeLoad: requireAuth,
    component: RestrictedLayoutRoute,
});

function RestrictedLayoutRoute() {
    const isBare = useIsBareShell();

    if (isBare) {
        return (
            <main>
                <Outlet />
            </main>
        );
    }

    return (
        <>
            <Header />
            <Navigation />
            <main className={main}>
                <Outlet />
            </main>
        </>
    );
}
