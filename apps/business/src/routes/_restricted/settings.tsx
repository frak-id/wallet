import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import {
    createFileRoute,
    Link,
    Outlet,
    useMatch,
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
    const billingMatch = useMatch({
        from: "/_restricted/settings/billing",
        shouldThrow: false,
    });
    const active = billingMatch ? "billing" : "usage";

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
                            disabled
                        >
                            {t("settings.tabs.billing")}
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
