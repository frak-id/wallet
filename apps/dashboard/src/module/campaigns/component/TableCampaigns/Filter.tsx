"use client";

import { tableCampaignFiltersAtom } from "@/module/campaigns/component/TableCampaigns/index";
import { Calendar } from "@/module/common/component/Calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { Button } from "@frak-labs/ui/component/Button";
import { InputSearch } from "@frak-labs/ui/component/forms/InputSearch";
import { format } from "date-fns";
import { atom, useAtom } from "jotai";
import { useSetAtom } from "jotai/index";
import { CalendarIcon, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import styles from "./index.module.css";

/**
 * Simple atom to ease the set of a title filter
 */
const titleFilterAtom = atom(
    (get) =>
        get(tableCampaignFiltersAtom).find((filter) => filter.id === "name")
            ?.value as string,
    (get, set, update?: string) => {
        const filters = get(tableCampaignFiltersAtom).filter(
            ({ id }) => id !== "title"
        );
        if (!update) {
            set(tableCampaignFiltersAtom, filters);
            return;
        }
        set(tableCampaignFiltersAtom, [
            ...filters,
            {
                id: "title",
                value: update,
            },
        ]);
    }
);

/**
 * Simple atom to ease the set of a date filter
 */
const dateFilterAtom = atom(
    (get) =>
        get(tableCampaignFiltersAtom).find((filter) => filter.id === "date")
            ?.value as Date,
    (get, set, update?: Date) => {
        const filters = get(tableCampaignFiltersAtom).filter(
            ({ id }) => id !== "date"
        );
        if (!update) {
            set(tableCampaignFiltersAtom, filters);
            return;
        }
        set(tableCampaignFiltersAtom, [
            ...filters,
            {
                id: "date",
                value: update,
            },
        ]);
    }
);

const resetAtom = atom(null, (_get, set) => {
    set(titleFilterAtom, undefined);
    set(dateFilterAtom, undefined);
});

export function TableCampaignFilters() {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const [currentTitle, setCurrentTitle] = useAtom(titleFilterAtom);
    const [currentDate, setCurrentDate] = useAtom(dateFilterAtom);
    const resetFilters = useSetAtom(resetAtom);

    return (
        <div className={styles.filters}>
            <div className={styles.filters__item}>
                <InputSearch
                    placeholder={"Search campaign..."}
                    classNameWrapper={styles.filters__search}
                    value={currentTitle}
                    onChange={(e) => setCurrentTitle(e.target.value)}
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
                                setCurrentDate(value);
                                setIsPopoverOpen(false);
                            }}
                        />
                    </PopoverContent>
                </Popover>
                <Button
                    variant={"secondary"}
                    leftIcon={<SlidersHorizontal size={20} />}
                    onClick={() => resetFilters()}
                >
                    Reset filters
                </Button>
            </div>
        </div>
    );
}
