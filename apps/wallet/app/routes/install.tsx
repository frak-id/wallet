import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { PageLayout } from "@/module/common/component/PageLayout";
import { InstallView } from "@/module/install/component/InstallView";
import { parseInstallSearch } from "@/module/install/params";
import * as styles from "./install.css";

/**
 * In-app `/install`, used by Tauri and by any client-side navigation.
 *
 * On the web this route is shadowed by the standalone `/install` entrypoint
 * (see `install.html` + `app/entry/install`), which serves the same
 * `InstallView` without booting the wallet shell.
 */
export const Route = createFileRoute("/install")({
    validateSearch: parseInstallSearch,
    component: InstallPage,
});

function InstallPage() {
    const search = Route.useSearch();
    const navigate = useNavigate();

    const navigation = useMemo(
        () => ({
            toWallet: () => navigate({ to: "/wallet", replace: true }),
            toRegister: () => navigate({ to: "/register", replace: true }),
        }),
        [navigate]
    );

    return (
        <InstallView
            search={search}
            navigation={navigation}
            processingLayout={ProcessingLayout}
        />
    );
}

/**
 * `PageLayout` inside the status-bar inset this route does not inherit — it
 * sits outside `AppShell`, which is what reserves it everywhere else.
 */
function ProcessingLayout({ children }: { children: ReactNode }) {
    return (
        <div className={styles.safeTop}>
            <PageLayout>{children}</PageLayout>
        </div>
    );
}
