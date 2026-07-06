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
import * as styles from "./index.css";

/**
 * Header action that opens the "Sort by" bottom sheet. Shows a red dot once a
 * non-default sort is applied.
 */
export function ExplorerSortButton() {
    const { t } = useTranslation();
    const sort = useStore(explorerSortStore, (s) => s.sort);
    const [open, setOpen] = useState(false);

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
