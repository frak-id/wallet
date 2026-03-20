import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { Header } from "@/module/common/component/Header";
import { Navigation } from "@/module/common/component/Navigation";
import "@/styles/restricted.css";
import styles from "./_restricted.module.css";

export const Route = createFileRoute("/_restricted")({
    beforeLoad: requireAuth,
    component: RestrictedLayoutRoute,
});

function RestrictedLayoutRoute() {
    return (
        <>
            <Header />
            <Navigation />
            <main className={styles.main}>
                <Outlet />
            </main>
        </>
    );
}
