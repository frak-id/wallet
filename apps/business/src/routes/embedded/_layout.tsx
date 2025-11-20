import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireEmbeddedAuth } from "@/middleware/embeddedAuth";
import styles from "./_layout.module.css";
import "./_layout.css";

export const Route = createFileRoute("/embedded/_layout")({
    beforeLoad: requireEmbeddedAuth,
    component: EmbeddedLayout,
});

function EmbeddedLayout() {
    return (
        <main className={styles.main}>
            <Outlet />
        </main>
    );
}
