"use client";

import { Button } from "@frak-labs/ui/component/Button";
import { InputSearch } from "@frak-labs/ui/component/forms/InputSearch";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { format } from "date-fns";
import { CalendarIcon, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Calendar } from "@/module/common/component/Calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import styles from "./index.module.css";

type TableCampaignFiltersProps = {
    columnFilters: ColumnFiltersState;
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
};

export function TableCampaignFilters({
    columnFilters,
    setColumnFilters,
}: TableCampaignFiltersProps) {
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

    // Reset all filters
    const resetFilters = () => {
        setTitleFilter("");
        setDateFilter(undefined);
    };

    return (
        <div className={styles.filters}>
            <div className={styles.filters__item}>
                <InputSearch
                    placeholder={"Search campaign..."}
                    classNameWrapper={styles.filters__search}
                    value={currentTitle}
                    onChange={(e) => setTitleFilter(e.target.value)}
                />
            </div>
            <div className={styles.filters__item}>
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"secondary"}
                            className={styles.filters__datePickerTrigger}
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
                    leftIcon={<SlidersHorizontal size={20} />}
                    onClick={resetFilters}
                >
                    Reset filters
                </Button>
            </div>
        </div>
    );
}
