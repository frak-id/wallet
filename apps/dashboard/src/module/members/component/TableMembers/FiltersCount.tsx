import { useAtom } from "jotai";
import { useEffect } from "react";
import { tableMembersFiltersCountAtom } from "@/module/members/atoms/tableMembers";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";
import styles from "./FiltersCount.module.css";

export function FiltersCount({ filter }: { filter?: FormMembersFiltering }) {
    const [filtersCount, setFiltersCount] = useAtom(
        tableMembersFiltersCountAtom
    );

    useEffect(() => {
        if (!filter) return;
        const allValues = filterOutUndefined(filter);
        setFiltersCount(allValues.length);
    }, [filter, setFiltersCount]);

    return (
        filtersCount > 0 && (
            <span className={styles.filters__count}>{filtersCount}</span>
        )
    );
}

/**
 * Filter out undefined values from the object
 * @param obj
 */
function filterOutUndefined(obj: FormMembersFiltering): string[] {
    const result: string[] = [];

    for (const key in obj) {
        // @ts-expect-error
        const value = obj[key];

        // Check if min/max are defined, or if the value is an array and not empty
        if (Array.isArray(value) && value.length > 0) {
            result.push(key);
        } else if (value && typeof value === "object") {
            // Check if min/max are defined and not undefined
            if (
                ("min" in value && value.min !== undefined) ||
                ("max" in value && value.max !== undefined)
            ) {
                result.push(key);
            }
        }
    }

    return result;
}
