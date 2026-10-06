import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { SortIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { ExplorerSortSheet } from "@/module/explorer/component/ExplorerSortSheet";
import {
    EXPLORER_SORT_OPTIONS,
    explorerSortStore,
    isCustomExplorerSort,
} from "@/module/explorer/stores/explorerSortStore";
import { hasNativeGlass } from "@/module/native-glass/bridge";
import { useNativeToolbar } from "@/module/native-glass/hook/useNativeToolbar";
import { useOverlayOpen } from "@/module/native-glass/hook/useOverlayOpen";
import { nativeColors } from "@/module/native-glass/tokens.css";
import * as styles from "./index.css";

/**
 * Header action for the Explorer sort. Shows a red dot once a non-default sort
 * is applied. iOS 26 gets a native glass button whose menu applies a sort in
 * one tap; elsewhere it opens the "Sort by" bottom sheet.
 */
export function ExplorerSortButton() {
    return hasNativeGlass() ? <NativeSortButton /> : <WebSortButton />;
}

function useSortState() {
    const { t } = useTranslation();
    const sort = useStore(explorerSortStore, (s) => s.sort);
    const isCustom = isCustomExplorerSort(sort);
    // Announce the active sort so the red dot (which is aria-hidden) isn't a
    // silent signal for screen-reader users.
    const activeLabelKey = EXPLORER_SORT_OPTIONS.find(
        (o) => o.value === sort
    )?.labelKey;
    const label =
        isCustom && activeLabelKey
            ? t("explorer.sort.openActive", { sort: t(activeLabelKey) })
            : t("explorer.sort.open");
    return { sort, isCustom, label };
}

function WebSortButton() {
    const { isCustom, label } = useSortState();
    const [open, setOpen] = useState(false);

    return (
        <>
            <span className={styles.wrapper}>
                <GlassButton
                    as="button"
                    icon={<SortIcon width={22} height={22} />}
                    onClick={() => setOpen(true)}
                    aria-label={label}
                />
                {isCustom && (
                    <span className={styles.dot} aria-hidden="true">
                        <span className={styles.dotCore} />
                    </span>
                )}
            </span>
            <ExplorerSortSheet open={open} onOpenChange={setOpen} />
        </>
    );
}

function NativeSortButton() {
    const { t } = useTranslation();
    const { sort, isCustom, label } = useSortState();
    const setSort = useStore(explorerSortStore, (s) => s.setSort);
    const overlayOpen = useOverlayOpen("top");

    useNativeToolbar("explorer", {
        // The sticky header row starts one content gap below the safe area.
        offsetTop: 16,
        trailing: [
            {
                id: "sort",
                icon: "glass-sort",
                label,
                color: nativeColors.secondary,
                badge: isCustom ? nativeColors.error : undefined,
                menu: {
                    title: t("explorer.sort.title"),
                    options: EXPLORER_SORT_OPTIONS.map((option) => ({
                        value: option.value,
                        title: t(option.labelKey),
                    })),
                    selected: sort,
                },
            },
        ],
        visible: !overlayOpen,
        onAction: (_itemId, value) => {
            const option = EXPLORER_SORT_OPTIONS.find((o) => o.value === value);
            if (option) setSort(option.value);
        },
    });

    // Holds the button's slot so the sticky header keeps its height.
    return <span className={styles.nativeSlot} aria-hidden="true" />;
}
