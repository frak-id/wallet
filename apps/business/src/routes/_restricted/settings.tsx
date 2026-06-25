import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import {
    createFileRoute,
    Link,
    Outlet,
    useLocation,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/module/common/component/PageShell";
import { content, tabContent } from "./settings.css";

export const Route = createFileRoute("/_restricted/settings")({
    component: SettingsLayout,
});

/**
 * Settings layout: the page heading + navigation tabs are shared; the active
 * tab is a route (`/settings` = usage, `/settings/billing` = billing) so it is
 * reflected in the URL and shareable. Tab content renders through the `Outlet`.
 */
function SettingsLayout() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const active = pathname.endsWith("/billing") ? "billing" : "usage";

    return (
        <PageShell page="settings" space="l">
            <div className={content}>
                <Tabs value={active}>
                    <TabsList variant="navigation">
                        <TabsTrigger value="usage" variant="navigation" asChild>
                            <Link to="/settings">
                                {t("settings.tabs.usage")}
                            </Link>
                        </TabsTrigger>
                        <TabsTrigger
                            value="billing"
                            variant="navigation"
                            asChild
                        >
                            <Link to="/settings/billing">
                                {t("settings.tabs.billing")}
                            </Link>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className={tabContent}>
                    <Outlet />
                </div>
            </div>
        </PageShell>
    );
}
