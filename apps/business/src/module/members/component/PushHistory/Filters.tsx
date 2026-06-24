import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CalendarIcon, FiltersIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { DateRangePopover } from "@/module/common/component/DateRangePopover";
import {
    formatRangeLabel,
    toIso,
} from "@/module/common/component/DateRangePopover/presets";
import { getDateFnsLocale } from "@/module/common/utils/dateLocale";
import { pushHistoryStore } from "@/stores/pushHistoryStore";
import * as styles from "./push-history.css";
import type { PushHistoryStatus } from "./types";

const STATUSES: PushHistoryStatus[] = ["scheduled", "sent"];

/**
 * Filter bar for the push history table: a date-range picker (on the
 * scheduled/sent time) and a status multi-select, right-aligned above the
 * table.
 */
export function PushHistoryFilters() {
    const { t, i18n } = useTranslation();
    const filters = pushHistoryStore((state) => state.filters);
    const setFilters = pushHistoryStore((state) => state.setFilters);

    const dateRange = filters.dateRange;
    const dateLabel = formatRangeLabel(
        dateRange?.from ? toIso(dateRange.from) : undefined,
        dateRange?.to ? toIso(dateRange.to) : undefined,
        t,
        getDateFnsLocale(i18n.language)
    );

    return (
        <Inline space="m" align="right">
            <DateRangePopover
                value={dateRange}
                onChange={(range) => {
                    // A single calendar click yields a one-ended range; treat
                    // it as that whole day so it commits a complete {min,max}.
                    const normalized =
                        range?.from && !range.to
                            ? { from: range.from, to: range.from }
                            : range;
                    setFilters((prev) => ({
                        ...prev,
                        dateRange: normalized,
                    }));
                }}
                align="end"
                trigger={
                    <Button
                        variant={"filter"}
                        size={"filter"}
                        icon={<CalendarIcon width={16} height={16} />}
                    >
                        {dateLabel}
                    </Button>
                }
            />
            <StatusFilterPopover />
        </Inline>
    );
}

function StatusFilterPopover() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const filters = pushHistoryStore((state) => state.filters);
    const setFilters = pushHistoryStore((state) => state.setFilters);

    const selected = filters.status ?? [];

    function toggle(status: PushHistoryStatus, checked: boolean) {
        setFilters((prev) => {
            const next = new Set(prev.status ?? []);
            if (checked) {
                next.add(status);
            } else {
                next.delete(status);
            }
            const list = [...next];
            return { ...prev, status: list.length > 0 ? list : undefined };
        });
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"filter"}
                    size={"filter"}
                    icon={<FiltersIcon width={16} height={16} />}
                >
                    {t("push.history.filters.button")}{" "}
                    {selected.length > 0 && (
                        <span className={styles.filtersCount}>
                            {selected.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                onEscapeKeyDown={() => setOpen(false)}
                className={styles.filtersPopoverContent}
            >
                <Stack space="m">
                    <Text as="span" variant="label">
                        {t("push.history.columns.status")}
                    </Text>
                    <Stack space="s">
                        {STATUSES.map((status) => {
                            const id = `push-status-${status}`;
                            return (
                                <label
                                    key={status}
                                    htmlFor={id}
                                    className={styles.statusOption}
                                >
                                    <Checkbox
                                        id={id}
                                        checked={selected.includes(status)}
                                        onCheckedChange={(checked) =>
                                            toggle(status, checked === true)
                                        }
                                    />
                                    <span>
                                        {t(`push.history.status.${status}`)}
                                    </span>
                                </label>
                            );
                        })}
                    </Stack>
                    {selected.length > 0 && (
                        <Button
                            variant={"secondary"}
                            size={"small"}
                            width={"full"}
                            onClick={() =>
                                setFilters((prev) => ({
                                    ...prev,
                                    status: undefined,
                                }))
                            }
                        >
                            {t("push.history.filters.reset")}
                        </Button>
                    )}
                </Stack>
            </PopoverContent>
        </Popover>
    );
}
