import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
} from "@frak-labs/design-system/components/Drawer";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Text } from "@frak-labs/design-system/components/Text";
import { visuallyHidden } from "@frak-labs/design-system/utils";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
    EXPLORER_SORT_OPTIONS,
    type ExplorerSort,
    explorerSortStore,
} from "@/module/explorer/stores/explorerSortStore";
import * as styles from "./index.css";

type ExplorerSortSheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function ExplorerSortSheet({
    open,
    onOpenChange,
}: ExplorerSortSheetProps) {
    const { t } = useTranslation();
    const applied = useStore(explorerSortStore, (s) => s.sort);
    const setSort = useStore(explorerSortStore, (s) => s.setSort);
    // Pending selection is local until the user taps "Apply", so dismissing
    // without applying leaves the active sort untouched.
    const [pending, setPending] = useState<ExplorerSort>(applied);

    // Re-sync the pending choice with the applied sort each time the sheet
    // opens, so a dismissed-without-applying session never leaks its state.
    useEffect(() => {
        if (open) setPending(applied);
    }, [open, applied]);

    // The trigger button keeps focus while Radix marks #root aria-hidden on
    // open, which warns "Blocked aria-hidden on a focused element". Blur it on
    // the open transition to close that gap (mirrors ResponsiveModal).
    useLayoutEffect(() => {
        if (!open) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
    }, [open]);

    const handleApply = () => {
        setSort(pending);
        onOpenChange(false);
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent
                hideHandle={true}
                edgeToEdge={true}
                surface="muted"
                aria-describedby={undefined}
            >
                {/* Visually-hidden accessible name for the dialog; the visible
                    heading below carries the DS typography (ResponsiveModal
                    pattern). */}
                <DrawerTitle className={visuallyHidden}>
                    {t("explorer.sort.title")}
                </DrawerTitle>

                <span className={styles.knobBar} aria-hidden="true" />

                <div className={styles.content}>
                    <Text variant="heading2" weight="bold">
                        {t("explorer.sort.title")}
                    </Text>

                    <RadioGroup
                        className={styles.optionsCard}
                        value={pending}
                        onValueChange={(value) =>
                            setPending(value as ExplorerSort)
                        }
                    >
                        {EXPLORER_SORT_OPTIONS.map((opt) => (
                            <div key={opt.value} className={styles.option}>
                                <label
                                    htmlFor={`explorer-sort-${opt.value}`}
                                    className={styles.optionLabel}
                                >
                                    {t(opt.labelKey)}
                                </label>
                                <RadioGroupItem
                                    id={`explorer-sort-${opt.value}`}
                                    value={opt.value}
                                    size="l"
                                />
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <Box className={styles.footer}>
                    <Button variant="primary" onClick={handleApply}>
                        {t("explorer.sort.apply")}
                    </Button>
                </Box>
            </DrawerContent>
        </Drawer>
    );
}
