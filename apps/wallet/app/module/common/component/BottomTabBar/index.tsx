import { Box } from "@frak-labs/design-system/components/Box";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { bottomTabBarStyles } from "./bottomTabBar.css";

export type TabItem = {
    key: string;
    label: string;
    icon: ReactNode;
    /**
     * If true, the tab navigates with `replace: true` so back-stack doesn't
     * accumulate when the user pings the same tab repeatedly. Use for the
     * "home" tab (e.g. /wallet) to keep history depth bounded.
     */
    replace?: boolean;
};

export type BottomTabBarProps = {
    tabs: TabItem[];
    activeKey: string;
};

export function BottomTabBar({ tabs, activeKey }: BottomTabBarProps) {
    const activeIndex = useMemo(
        () =>
            Math.max(
                tabs.findIndex((t) => t.key === activeKey),
                0
            ),
        [tabs, activeKey]
    );

    const gliderTranslateStep = useMemo(() => {
        if (tabs.length <= 1) {
            return 0;
        }

        const widthRatio = 1 / tabs.length;
        const availableTrack = 1 - widthRatio;
        const stepRatio = availableTrack / (tabs.length - 1);

        return (stepRatio / widthRatio) * 100;
    }, [tabs.length]);
    return (
        <Box className={bottomTabBarStyles.wrapper}>
            {/* Progressive blur background */}
            <Box
                className={bottomTabBarStyles.progressiveBlur}
                aria-hidden="true"
            />
            <Box
                as="nav"
                className={bottomTabBarStyles.pill}
                aria-label="Tab navigation"
            >
                {tabs.map((tab) => {
                    const isActive = tab.key === activeKey;
                    return (
                        <Link
                            key={tab.key}
                            to={tab.key}
                            replace={tab.replace}
                            className={`${bottomTabBarStyles.tab}${isActive ? ` ${bottomTabBarStyles.tabActive}` : ""}`}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <Box
                                as="span"
                                className={
                                    isActive
                                        ? bottomTabBarStyles.tabIconWrapperActive
                                        : bottomTabBarStyles.tabIconWrapper
                                }
                            >
                                {tab.icon}
                            </Box>
                            <Box
                                as="span"
                                className={bottomTabBarStyles.tabLabel}
                            >
                                {tab.label}
                            </Box>
                        </Link>
                    );
                })}
                {/* Sliding glider — position driven by active tab index */}
                <span
                    className={bottomTabBarStyles.glider}
                    style={{
                        width: `calc((100% - 4px) / ${tabs.length})`,
                        transform: `translateX(${activeIndex * gliderTranslateStep}%)`,
                    }}
                    aria-hidden="true"
                />
            </Box>
        </Box>
    );
}
