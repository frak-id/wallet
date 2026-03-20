import { Box } from "@frak-labs/design-system/components/Box";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { bottomTabBarStyles } from "./bottomTabBar.css";
import tabsBg from "./tabs-bg.png";

export type TabItem = {
    key: string;
    label: string;
    icon: ReactNode;
};

export type BottomTabBarProps = {
    tabs: TabItem[];
    activeKey: string;
    onTabChange: (key: string) => void;
};

export function BottomTabBar({
    tabs,
    activeKey,
    onTabChange,
}: BottomTabBarProps) {
    const selectionWidthRatio = 102 / 286;
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

        const availableTrack = 1 - selectionWidthRatio;
        const stepRatio = availableTrack / (tabs.length - 1);

        return (stepRatio / selectionWidthRatio) * 100;
    }, [tabs.length]);

    return (
        <Box className={bottomTabBarStyles.wrapper}>
            <img
                src={tabsBg}
                alt=""
                className={bottomTabBarStyles.backgroundImage}
                aria-hidden="true"
                draggable={false}
            />
            <Box
                as="nav"
                className={bottomTabBarStyles.pill}
                aria-label="Tab navigation"
            >
                {tabs.map((tab) => {
                    const isActive = tab.key === activeKey;
                    return (
                        <Box
                            key={tab.key}
                            as="button"
                            type="button"
                            className={`${bottomTabBarStyles.tab}${isActive ? ` ${bottomTabBarStyles.tabActive}` : ""}`}
                            onClick={() => onTabChange(tab.key)}
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
                        </Box>
                    );
                })}
                {/* Sliding glider — position driven by active tab index */}
                <span
                    className={bottomTabBarStyles.glider}
                    style={{
                        transform: `translateX(${activeIndex * gliderTranslateStep}%)`,
                    }}
                    aria-hidden="true"
                />
            </Box>
        </Box>
    );
}
