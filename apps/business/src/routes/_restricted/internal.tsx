import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import {
    createFileRoute,
    Link,
    Outlet,
    redirect,
    useLocation,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "@/config/auth";
import { PageShell } from "@/module/common/component/PageShell";
import { pageNav } from "@/module/common/i18n/pageLabel";
import { queryClient } from "@/module/common/provider/RootProvider";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";
import { tabContent } from "./internal.css";

const TABS = [
    { value: "game", to: "/internal/game", page: "internalGame" },
    { value: "codes", to: "/internal/codes", page: "internalCodes" },
    { value: "lookup", to: "/internal/lookup", page: "internalLookup" },
    {
        value: "setup-code",
        to: "/internal/setup-code",
        page: "internalSetupCode",
    },
] as const;

export const Route = createFileRoute("/_restricted/internal")({
    // The whole section is platform-admin only; the backend enforces it on every route too.
    beforeLoad: async () => {
        const my = await queryClient.ensureQueryData(
            myMerchantsQueryOptions(isDemoMode())
        );
        if (!my.isPlatformAdmin) {
            throw redirect({ to: "/dashboard", replace: true });
        }
    },
    component: InternalLayout,
});

function InternalLayout() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const active =
        TABS.find((tab) => pathname.startsWith(tab.to))?.value ?? "game";

    return (
        <PageShell page="internal" space="l">
            <Tabs value={active}>
                <TabsList variant="navigation">
                    {TABS.map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            variant="navigation"
                            asChild
                        >
                            <Link to={tab.to}>{pageNav(t, tab.page)}</Link>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <div className={tabContent}>
                <Outlet />
            </div>
        </PageShell>
    );
}
