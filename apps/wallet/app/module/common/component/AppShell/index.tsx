import { BannerStack } from "@frak-labs/design-system/components/BannerStack";
import { Box } from "@frak-labs/design-system/components/Box";
import {
    ExplorerIcon,
    ProfileIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import {
    InAppBrowserToast,
    OfflineBanner,
    WebauthnErrorToast,
} from "@frak-labs/wallet-shared";
import { Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef } from "react";
import {
    BottomTabBar,
    type TabItem,
} from "@/module/common/component/BottomTabBar";
import { ErrorBoundary } from "@/module/common/component/ErrorBoundary";
import { ModalErrorToast } from "@/module/common/component/ModalErrorToast";
import { SessionExpiringBanner } from "@/module/common/component/SessionExpiringBanner";
import { hasNativeGlass } from "@/module/native-glass/bridge";
import { NativeTabBar } from "@/module/native-glass/component/NativeTabBar";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { EnsureConflictToast } from "@/module/pending-actions/component/EnsureConflictToast";
import {
    bottomBar,
    mainContentNoNav,
    mainContentWithNav,
    navBarScrim,
    shellContainer,
    shellContainerPage,
    statusBarScrim,
} from "./appShell.css";
import { AppShellScrollContext } from "./scrollContext";

// Re-export so consumers can import from "@/module/common/component/AppShell"
// and treat scrollContext.tsx as an internal detail.
export { useAppShellScroll } from "./scrollContext";

const tabs: TabItem[] = [
    {
        key: "/wallet",
        label: "Porte-monnaie",
        icon: <WalletIcon />,
        nativeIcon: "tab-wallet",
    },
    {
        key: "/explorer",
        label: "Explorer",
        icon: <ExplorerIcon />,
        nativeIcon: "tab-explorer",
    },
    {
        key: "/profile",
        label: "Profil",
        icon: <ProfileIcon />,
        nativeIcon: "tab-profile",
    },
];

// Home tab key. The bottom tab bar uses this to keep the back-stack bounded:
// pressing back from /explorer or /profile returns to /wallet in a single jump,
// rather than walking through every tab the user visited.
const TAB_HOME_KEY = "/wallet";

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
    /** Every page of the layout is white: paint it before one mounts. */
    pageSurface?: boolean;
    /** Content to render. If omitted, renders a Router Outlet. */
    children?: ReactNode;
}>;

/**
 * Exposes the main scroll container via AppShellScrollContext for pull-to-refresh.
 */
export function AppShell({
    navigation = false,
    pageSurface = false,
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

    const scrollToTop = useCallback(() => {
        mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    return (
        <AppShellScrollContext.Provider value={scrollValue}>
            <Box className={pageSurface ? shellContainerPage : shellContainer}>
                <InAppBrowserToast />
                <BannerStack>
                    <OfflineBanner />
                    <SessionExpiringBanner />
                    <PairingInProgress />
                    <WebauthnErrorToast />
                    <EnsureConflictToast />
                    <ModalErrorToast />
                </BannerStack>
                <Box
                    as="main"
                    ref={mainRef}
                    className={
                        navigation ? mainContentWithNav : mainContentNoNav
                    }
                >
                    <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
                </Box>
                {navigation && hasNativeGlass() && (
                    <NativeTabBar
                        tabs={tabs}
                        activeKey={activeKey}
                        homeKey={TAB_HOME_KEY}
                        onReselect={scrollToTop}
                    />
                )}
                {navigation && !hasNativeGlass() && (
                    <Box className={bottomBar}>
                        <BottomTabBar
                            tabs={tabs}
                            activeKey={activeKey}
                            homeKey={TAB_HOME_KEY}
                        />
                    </Box>
                )}
                <Box className={statusBarScrim} aria-hidden="true" />
                <Box className={navBarScrim} aria-hidden="true" />
            </Box>
        </AppShellScrollContext.Provider>
    );
}
