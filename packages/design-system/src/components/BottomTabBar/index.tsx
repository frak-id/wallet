import type { ReactNode } from "react";
import { Box } from "@/components/Box";
import { bottomTabBarStyles } from "./bottomTabBar.css";

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
    return (
        <Box
            as="nav"
            className={bottomTabBarStyles.container}
            aria-label="Tab navigation"
        >
            {tabs.map((tab) => {
                const isActive = tab.key === activeKey;
                return (
                    <Box
                        key={tab.key}
                        as="button"
                        type="button"
                        className={bottomTabBarStyles.tab}
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
                            className={
                                isActive
                                    ? bottomTabBarStyles.tabLabelActive
                                    : bottomTabBarStyles.tabLabel
                            }
                        >
                            {tab.label}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}
