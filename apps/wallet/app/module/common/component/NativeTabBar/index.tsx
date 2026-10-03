import { useRouter } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useMemo } from "react";
import {
    shouldReplaceTab,
    type TabItem,
} from "@/module/common/component/BottomTabBar";
import { onNativeTabSelected, syncNativeTabBar } from "./bridge";
import { nativeTabTint } from "./nativeTabBar.css";
import { useOverlayOpen } from "./useOverlayOpen";

export { hasNativeTabBar, initNativeTabBar } from "./bridge";

type NativeTabBarProps = {
    tabs: TabItem[];
    activeKey: string;
    homeKey?: string;
    /** Re-tapping the active tab: iOS convention is scroll-to-top. */
    onReselect?: () => void;
};

/**
 * Drives the iOS Liquid Glass `UITabBar` (`tauri-plugin-frak-tab-bar`). Renders
 * nothing: the bar is a native view over the webview, shown while mounted.
 */
export function NativeTabBar({
    tabs,
    activeKey,
    homeKey,
    onReselect,
}: NativeTabBarProps) {
    const router = useRouter();
    const overlayOpen = useOverlayOpen();

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
        syncNativeTabBar({ items, tint: nativeTabTint });
    }, [items]);

    useEffect(() => {
        syncNativeTabBar({ selectedKey: activeKey });
    }, [activeKey]);

    useEffect(() => {
        syncNativeTabBar({ visible: !overlayOpen });
        return () => syncNativeTabBar({ visible: false });
    }, [overlayOpen]);

    // `<Link>`s preload on render; nothing renders here, so preload by hand.
    useEffect(() => {
        for (const tab of tabs) {
            router.preloadRoute({ to: tab.key }).catch(() => {});
        }
    }, [router, tabs]);

    const onSelect = useEffectEvent(({ key }: { key: string }) => {
        if (key === activeKey) {
            onReselect?.();
            return;
        }
        router.navigate({
            to: key,
            replace: shouldReplaceTab(key, activeKey, homeKey),
        });
    });

    useEffect(() => {
        const listener = onNativeTabSelected((event) => onSelect(event));
        return () => {
            listener.then((l) => l.unregister()).catch(() => {});
        };
    }, []);

    return null;
}
