import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { format } from "date-fns";
import { CalendarIcon, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { Calendar } from "@/module/common/component/Calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { InputSearch } from "@/module/forms/InputSearch";
import type { CampaignStatus } from "@/types/Campaign";
import * as styles from "./filter.css";

export type CampaignTab = "all" | CampaignStatus | "ended";

const tabValues: CampaignTab[] = [
    "all",
    "active",
    "paused",
    "draft",
    "ended",
    "archived",
];

type TableCampaignFiltersProps = {
    columnFilters: ColumnFiltersState;
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
};

export function TableCampaignFilters({
    columnFilters,
    setColumnFilters,
}: TableCampaignFiltersProps) {
    const { t } = useTranslation();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    // Extract current values from columnFilters
    const currentTitle = useMemo(
        () =>
            (columnFilters.find((filter) => filter.id === "title")
                ?.value as string) || "",
        [columnFilters]
    );

    const currentDate = useMemo(
        () =>
            columnFilters.find((filter) => filter.id === "date")?.value as Date,
        [columnFilters]
    );

    const currentStatus = useMemo<CampaignTab>(
        () =>
            (columnFilters.find((filter) => filter.id === "status")
                ?.value as CampaignTab) ?? "all",
        [columnFilters]
    );

    // Helper to update title filter
    const setTitleFilter = (value: string) => {
        setColumnFilters((prev) => {
            const filtered = prev.filter((f) => f.id !== "title");
            if (!value) return filtered;
            return [...filtered, { id: "title", value }];
        });
    };

    // Helper to update date filter
    const setDateFilter = (value?: Date) => {
        setColumnFilters((prev) => {
            const filtered = prev.filter((f) => f.id !== "date");
            if (!value) return filtered;
            return [...filtered, { id: "date", value }];
        });
    };

    // Helper to update status tab filter. "all" clears the filter.
    const setStatusFilter = (value: CampaignTab) => {
        setColumnFilters((prev) => {
            const filtered = prev.filter((f) => f.id !== "status");
            if (value === "all") return filtered;
            return [...filtered, { id: "status", value }];
        });
    };

    // Reset all filters
    const resetFilters = () => {
        setTitleFilter("");
        setDateFilter(undefined);
        setStatusFilter("all");
    };

    return (
        <div className={styles.filters}>
            <Inline space="xs" alignY="center">
                <InputSearch
                    placeholder={"Search campaign..."}
                    className={styles.filtersSearch}
                    value={currentTitle}
                    onChange={(e) => setTitleFilter(e.target.value)}
                />
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"secondary"}
                            className={styles.filtersDatePickerTrigger}
                        >
                            <CalendarIcon size={20} />
                            <span>
                                {currentDate && format(currentDate, "PPP")}
                            </span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end">
                        <Calendar
                            mode="single"
                            selected={currentDate}
                            onSelect={(value) => {
                                if (!value) return;
                                setDateFilter(value);
                                setIsPopoverOpen(false);
                            }}
                        />
                    </PopoverContent>
                </Popover>
                <Button
                    variant={"secondary"}
                    icon={<SlidersHorizontal size={20} />}
                    onClick={resetFilters}
                >
                    Reset filters
                </Button>
            </Inline>
            <Tabs
                value={currentStatus}
                onValueChange={(value) => setStatusFilter(value as CampaignTab)}
            >
                <TabsList aria-label="Filter campaigns by status">
                    {tabValues.map((tab) => (
                        <TabsTrigger key={tab} value={tab}>
                            {t(`campaigns.tabs.${tab}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );
}
