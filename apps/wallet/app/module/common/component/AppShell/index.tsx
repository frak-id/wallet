import {
    BottomTabBar,
    type TabItem,
} from "@frak-labs/design-system/components/BottomTabBar";
import { Box } from "@frak-labs/design-system/components/Box";
import { InAppBrowserToast } from "@frak-labs/wallet-shared";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { History, Settings, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import {
    bottomBar,
    mainContent,
    mainNoHeaderNoNav,
    mainNoNav,
    shellContainer,
} from "./appShell.css";

/**
 * Tab definitions matching the existing Navigation component routes.
 */
const tabs: TabItem[] = [
    { key: "/wallet", label: "Wallet", icon: <Wallet size={20} /> },
    { key: "/history", label: "History", icon: <History size={20} /> },
    { key: "/settings", label: "Settings", icon: <Settings size={20} /> },
];

/**
 * Resolve active tab key from current pathname.
 * Matches the first tab whose key is a prefix of the current path.
 */
function resolveActiveTab(pathname: string): string {
    for (const tab of tabs) {
        if (pathname === tab.key || pathname.startsWith(`${tab.key}/`)) {
            return tab.key;
        }
    }
    return tabs[0].key;
}

type AppShellProps = Readonly<{
    /** Show the bottom tab bar navigation. Defaults to false. */
    navigation?: boolean;
    /** Content to render. If omitted, renders a Router Outlet. */
    children?: ReactNode;
}>;

/**
 * Unified app shell: sizing (safe areas, nav margin) + optional bottom tab bar.
 * No header — wallet app removed header area.
 */
export function AppShell({ navigation = false, children }: AppShellProps) {
    const navigate = useNavigate();
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });

    const activeKey = useMemo(() => resolveActiveTab(pathname), [pathname]);

    const mainClassName = [
        mainContent,
        !navigation && mainNoNav,
        !navigation && mainNoHeaderNoNav,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Box className={shellContainer}>
            <InAppBrowserToast />
            <Box as="main" className={mainClassName}>
                {children ?? <Outlet />}
            </Box>
            {navigation && (
                <Box className={bottomBar}>
                    <BottomTabBar
                        tabs={tabs}
                        activeKey={activeKey}
                        onTabChange={(key) => {
                            navigate({ to: key });
                        }}
                    />
                </Box>
            )}
        </Box>
    );
}
