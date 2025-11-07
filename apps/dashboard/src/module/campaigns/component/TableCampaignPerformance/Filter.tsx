"use client";
import { Button } from "@frak-labs/ui/component/Button";
import { InputSearch } from "@frak-labs/ui/component/forms/InputSearch";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import styles from "./index.module.css";

type TablePerformanceFiltersProps = {
    columnFilters: ColumnFiltersState;
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
};

export function TablePerformanceFilters({
    columnFilters,
    setColumnFilters,
}: TablePerformanceFiltersProps) {
    // Extract current title from columnFilters
    const currentTitle = useMemo(
        () =>
            (columnFilters.find((filter) => filter.id === "title")
                ?.value as string) || "",
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

    // Reset all filters
    const resetFilters = () => {
        setTitleFilter("");
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
