import { useEffect, useMemo } from "react";
import { createNativeSync } from "../bridge";
import { useNativeEvent } from "./useNativeEvent";

export type NativeToolbarItem = {
    id: string;
    /** Asset-catalog image in the iOS app bundle, or an SF Symbol name. */
    icon: string;
    /** VoiceOver label; the native button shows no text. */
    label: string;
    /** `#rrggbb` icon colour; the system label colour when absent. */
    color?: string;
    /** `#rrggbb` dot on the top-trailing corner; no dot when absent. */
    badge?: string;
    /** Single-choice menu the button opens instead of firing a tap. */
    menu?: {
        title?: string;
        options: { value: string; title: string }[];
        selected?: string;
    };
};

type NativeToolbarOptions = {
    /** Points below the top safe-area inset; native clamps the row to at least 16pt. */
    offsetTop?: number;
    leading?: NativeToolbarItem[];
    trailing?: NativeToolbarItem[];
    visible: boolean;
    /** `value` is the picked option for a menu item. */
    onAction: (itemId: string, value?: string) => void;
};

type ToolbarState = {
    id: string;
    offsetTop: number;
    leading: NativeToolbarItem[];
    trailing: NativeToolbarItem[];
    visible: boolean;
};

// One sync per toolbar id, shared across mounts, so an unmount/remount pair
// coalesces into its net state instead of racing two native calls.
const syncs = new Map<string, (patch: Partial<ToolbarState>) => void>();

function syncFor(id: string) {
    let sync = syncs.get(id);
    if (!sync) {
        sync = createNativeSync<ToolbarState>("set_toolbar", {
            id,
            offsetTop: 0,
            leading: [],
            trailing: [],
            visible: false,
        });
        syncs.set(id, sync);
    }
    return sync;
}

/**
 * Shows a row of native Liquid Glass buttons pinned under the status bar while
 * mounted and `visible`. Taps come back through `onAction` with the item id.
 */
export function useNativeToolbar(
    id: string,
    {
        offsetTop = 0,
        leading,
        trailing,
        visible,
        onAction,
    }: NativeToolbarOptions
) {
    const sync = syncFor(id);
    // Callers build item arrays inline; compare by content, not identity.
    const layoutKey = JSON.stringify([
        offsetTop,
        leading ?? [],
        trailing ?? [],
    ]);
    const layout = useMemo(() => {
        const [top, lead, trail] = JSON.parse(layoutKey) as [
            number,
            NativeToolbarItem[],
            NativeToolbarItem[],
        ];
        return { offsetTop: top, leading: lead, trailing: trail };
    }, [layoutKey]);

    useEffect(() => {
        sync(layout);
    }, [sync, layout]);

    useEffect(() => {
        sync({ visible });
        return () => sync({ visible: false });
    }, [sync, visible]);

    useNativeEvent<{ toolbarId: string; itemId: string; value?: string }>(
        "toolbarAction",
        ({ toolbarId, itemId, value }) => {
            if (toolbarId === id) onAction(itemId, value);
        }
    );
}
