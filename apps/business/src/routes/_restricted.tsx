import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Header } from "@/module/common/component/Header";
import { MainLayout } from "@/module/common/component/MainLayout";
import { Navigation } from "@/module/common/component/Navigation";
import "@/styles/restricted.css";

export const Route = createFileRoute("/_restricted")({
    beforeLoad: requireAuth,
    component: RestrictedLayoutRoute,
});

function RestrictedLayoutRoute() {
    return (
        <>
            <Header />
            <Navigation />
            <MainLayout>
                <Outlet />
            </MainLayout>
        </>
    );
}
