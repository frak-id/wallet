import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { requireAuth } from "@/middleware/auth";
import { DemoModeSync } from "@/module/common/component/DemoModeSync";
import { Header } from "@/module/common/component/Header";
import { MainLayout } from "@/module/common/component/MainLayout";
import { Navigation } from "@/module/common/component/Navigation";
import "@/styles/restricted.css";

export const Route = createFileRoute("/_restricted")({
    beforeLoad: requireAuth,
    component: RestrictedLayoutRoute,
});

function RestrictedLayoutRoute() {
    /**
     * Add a data attribute to the root element to style the layout
     */
    useEffect(() => {
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.dataset.page = "restricted";
        }

        return () => {
            rootElement.removeAttribute("data-page");
        };
    }, []);

    return (
        <>
            <DemoModeSync />
            <Header />
            <Navigation />
            <MainLayout>
                <Outlet />
            </MainLayout>
        </>
    );
}
