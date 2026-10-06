import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
    shouldReplaceTab,
    type TabItem,
} from "@/module/common/component/BottomTabBar";
import { createNativeSync } from "../../bridge";
import { NATIVE_TAB_BAR_HEIGHT_VAR } from "../../constants";
import { useNativeEvent } from "../../hook/useNativeEvent";
import { useOverlayOpen } from "../../hook/useOverlayOpen";
import { nativeColors } from "../../tokens.css";

const syncTabBar = createNativeSync(
    "set_tab_bar",
    {
        items: [] as { key: string; title: string; icon: string }[],
        selectedKey: null as string | null,
        visible: false,
        tint: nativeColors.action,
    },
    ({ height }: { height: number }) => {
        document.documentElement.style.setProperty(
            NATIVE_TAB_BAR_HEIGHT_VAR,
            `${height}px`
        );
    }
);

type NativeTabBarProps = {
    tabs: TabItem[];
    activeKey: string;
    homeKey?: string;
    /** Re-tapping the active tab: iOS convention is scroll-to-top. */
    onReselect?: () => void;
};

/**
 * Drives the native Liquid Glass `UITabBar`, the iOS 26 twin of `BottomTabBar`.
 * Renders nothing: the bar is a native view over the webview, shown while mounted.
 */
export function NativeTabBar({
    tabs,
    activeKey,
    homeKey,
    onReselect,
}: NativeTabBarProps) {
    const router = useRouter();
    const overlayOpen = useOverlayOpen("bottom");

    const items = useMemo(
        () =>
            tabs.map((tab) => ({
                key: tab.key,
                title: tab.label,
                icon: tab.nativeIcon,
            })),
        [tabs]
    );

    useEffect(() => {
        syncTabBar({ items });
    }, [items]);

    useEffect(() => {
        syncTabBar({ selectedKey: activeKey });
    }, [activeKey]);

    useEffect(() => {
        syncTabBar({ visible: !overlayOpen });
        return () => syncTabBar({ visible: false });
    }, [overlayOpen]);

    // `<Link>`s preload on render; nothing renders here, so preload by hand.
    useEffect(() => {
        for (const tab of tabs) {
            router.preloadRoute({ to: tab.key }).catch(() => {});
        }
    }, [router, tabs]);

    useNativeEvent<{ key: string }>("tabSelected", ({ key }) => {
        // A tap can land in the round trip before native hears of a hide.
        if (overlayOpen) return;
        if (key === activeKey) {
            onReselect?.();
            return;
        }
        router.navigate({
            to: key,
            replace: shouldReplaceTab(key, activeKey, homeKey),
        });
    });

    return null;
}
