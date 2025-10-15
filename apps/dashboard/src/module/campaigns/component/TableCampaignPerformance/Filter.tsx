"use client";
import { Button } from "@frak-labs/ui/component/Button";
import { InputSearch } from "@frak-labs/ui/component/forms/InputSearch";
import { atom, useAtom } from "jotai";
import { useSetAtom } from "jotai/index";
import { SlidersHorizontal } from "lucide-react";
import { tablePerformanceFiltersAtom } from "@/module/campaigns/component/TableCampaignPerformance/index";
import styles from "./index.module.css";

/**
 * Simple atom to ease the set of a title filter
 */
const titleFilterAtom = atom(
    (get) =>
        get(tablePerformanceFiltersAtom).find((filter) => filter.id === "name")
            ?.value as string,
    (get, set, update?: string) => {
        const filters = get(tablePerformanceFiltersAtom).filter(
            ({ id }) => id !== "title"
        );
        if (!update) {
            set(tablePerformanceFiltersAtom, filters);
            return;
        }
        set(tablePerformanceFiltersAtom, [
            ...filters,
            {
                id: "title",
                value: update,
            },
        ]);
    }
);

const resetAtom = atom(null, (_get, set) => {
    set(titleFilterAtom, undefined);
});

export function TablePerformanceFilters() {
    const [currentTitle, setCurrentTitle] = useAtom(titleFilterAtom);
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
