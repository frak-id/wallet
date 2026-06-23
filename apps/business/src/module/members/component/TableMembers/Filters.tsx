import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { CalendarIcon, FiltersIcon } from "@frak-labs/design-system/icons";
import { endOfDay, startOfDay } from "date-fns";
import { type ReactNode, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { DateRangePopover } from "@/module/common/component/DateRangePopover";
import {
    formatRangeLabel,
    toIso,
} from "@/module/common/component/DateRangePopover/presets";
import { getDateFnsLocale } from "@/module/common/utils/dateLocale";
import {
    type FormMembersFiltering,
    MembersFiltering,
    type MembersFilteringSection,
} from "@/module/members/component/MembersFiltering";
import { FiltersCount } from "@/module/members/component/TableMembers/FiltersCount";
import { membersStore } from "@/stores/membersStore";
import * as styles from "./filters.css";

type DateBound = NonNullable<FormMembersFiltering>["firstInteractionTimestamp"];

/** Members store the membership-date window as a unix-seconds {min,max}. */
function boundToRange(bound: DateBound): DateRange | undefined {
    if (!bound?.min) return undefined;
    return {
        from: new Date(bound.min * 1000),
        to: bound.max ? new Date(bound.max * 1000) : undefined,
    };
}

function rangeToBound(range: DateRange | undefined): DateBound {
    if (!range?.from) return undefined;
    return {
        min: Math.floor(startOfDay(range.from).getTime() / 1000),
        max: range.to
            ? Math.floor(endOfDay(range.to).getTime() / 1000)
            : undefined,
    };
}

export function TableMembersFilters() {
    const { t, i18n } = useTranslation();
    const tableMembersFilters = membersStore((state) => state.tableFilters);
    const setTableMembersFilters = membersStore(
        (state) => state.setTableFilters
    );

    function setFilter(filter: FormMembersFiltering) {
        setTableMembersFilters((filters) => ({
            ...filters,
            filter: { ...filters.filter, ...filter },
        }));
    }

    const dateRange = boundToRange(
        tableMembersFilters.filter?.firstInteractionTimestamp
    );
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
                    // A single calendar click yields a one-ended range
                    // ({from, to: undefined}); treat it as that whole day so
                    // it filters to a single day (like the campaigns picker)
                    // and commits a complete {min,max} bound.
                    const normalized =
                        range?.from && !range.to
                            ? { from: range.from, to: range.from }
                            : range;
                    setFilter({
                        firstInteractionTimestamp: rangeToBound(normalized),
                    });
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
            <FilterPopover
                section="interactions"
                icon={<FiltersIcon />}
                label={
                    <>
                        {t("members.filters.button")}{" "}
                        {/* Count only the filters this popover owns; the date
                            range has its own "Période" button. */}
                        <FiltersCount
                            filter={{
                                interactions:
                                    tableMembersFilters.filter?.interactions,
                            }}
                        />
                    </>
                }
                initialValue={tableMembersFilters.filter}
                onFilterSet={setFilter}
            />
        </Inline>
    );
}

function FilterPopover({
    section,
    icon,
    label,
    initialValue,
    onFilterSet,
}: {
    section: MembersFilteringSection;
    icon: ReactNode;
    label: ReactNode;
    initialValue?: FormMembersFiltering;
    onFilterSet: (filter: FormMembersFiltering) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant={"filter"} size={"filter"} icon={icon}>
                    {label}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                onEscapeKeyDown={() => setIsOpen(false)}
                className={styles.filtersPopoverContent}
            >
                <MembersFiltering
                    section={section}
                    initialValue={initialValue}
                    onFilterSet={onFilterSet}
                    showResetButton={true}
                />
            </PopoverContent>
        </Popover>
    );
}
