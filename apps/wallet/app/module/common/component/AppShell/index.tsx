import { BannerStack } from "@frak-labs/design-system/components/BannerStack";
import { Box } from "@frak-labs/design-system/components/Box";
import {
    ExplorerIcon,
    ProfileIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import { InAppBrowserToast, OfflineBanner } from "@frak-labs/wallet-shared";
import { Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import {
    BottomTabBar,
    type TabItem,
} from "@/module/common/component/BottomTabBar";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import {
    bottomBar,
    mainContentNoNav,
    mainContentWithNav,
    shellContainer,
    shellContainerAuth,
} from "./appShell.css";
import { AppShellScrollContext } from "./scrollContext";

// Re-export so consumers can import from "@/module/common/component/AppShell"
// and treat scrollContext.tsx as an internal detail.
export { useAppShellScroll } from "./scrollContext";

/**
 * Tab definitions matching the existing Navigation component routes.
 */
const tabs: TabItem[] = [
    { key: "/wallet", label: "Porte-monnaie", icon: <WalletIcon /> },
    { key: "/explorer", label: "Explorer", icon: <ExplorerIcon /> },
    { key: "/profile", label: "Profil", icon: <ProfileIcon /> },
];

// Home tab key. The bottom tab bar uses this to keep the back-stack bounded:
// pressing back from /explorer or /profile returns to /wallet in a single jump,
// rather than walking through every tab the user visited.
const TAB_HOME_KEY = "/wallet";

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
    /** Auth/onboarding screen — white background behind notch. */
    auth?: boolean;
    /** Content to render. If omitted, renders a Router Outlet. */
    children?: ReactNode;
}>;

/**
 * Unified app shell: sizing (safe areas, nav margin) + optional bottom tab bar.
 * No header — wallet app removed header area.
 * Exposes the main scroll container via AppShellScrollContext for pull-to-refresh.
 */
export function AppShell({
    navigation = false,
    auth = false,
    children,
}: AppShellProps) {
    // Navigation is handled by `<Link>`s inside BottomTabBar — no imperative
    // `useNavigate` needed here, which also unlocks the router's render-time
    // preload of the destination routes.
    const mainRef = useRef<HTMLElement>(null);
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });

    const activeKey = useMemo(() => resolveActiveTab(pathname), [pathname]);

    // Memoize provider value so consumers don't re-render on every AppShell
    // render (e.g. on every pathname change). The ref identity is stable.
    const scrollValue = useMemo(() => ({ scrollContainerRef: mainRef }), []);

    return (
        <AppShellScrollContext.Provider value={scrollValue}>
            <Box className={auth ? shellContainerAuth : shellContainer}>
                <InAppBrowserToast />
                <BannerStack>
                    <OfflineBanner />
                    <PairingInProgress />
                </BannerStack>
                <Box
                    as="main"
                    ref={mainRef}
                    className={
                        navigation ? mainContentWithNav : mainContentNoNav
                    }
                >
                    {children ?? <Outlet />}
                </Box>
                {navigation && (
                    <Box className={bottomBar}>
                        <BottomTabBar
                            tabs={tabs}
                            activeKey={activeKey}
                            homeKey={TAB_HOME_KEY}
                        />
                    </Box>
                )}
            </Box>
        </AppShellScrollContext.Provider>
    );
}
