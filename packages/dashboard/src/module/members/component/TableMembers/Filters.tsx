"use client";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { tableMembersFiltersAtom } from "@/module/members/atoms/tableMembers";
import { MembersFiltering } from "@/module/members/component/MembersFiltering";
import { Button } from "@module/component/Button";
import { useSetAtom } from "jotai";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import styles from "./Filters.module.css";

export function TableMembersFilters() {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const setTableMembersFilters = useSetAtom(tableMembersFiltersAtom);

    return (
        <div className={styles.filters}>
            {/*<div className={styles.filters__item}>
                <InputSearch
                    placeholder={"Search members..."}
                    classNameWrapper={styles.filters__search}
                />
            </div>*/}
            <div className={styles.filters__item}>
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"secondary"}
                            leftIcon={<SlidersHorizontal size={20} />}
                        >
                            Filters
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        onEscapeKeyDown={() => setIsPopoverOpen(false)}
                        className={styles.filters__popoverContent}
                    >
                        <MembersFiltering
                            onFilterSet={(filter) => {
                                setTableMembersFilters((filters) => ({
                                    ...filters,
                                    filter: { ...filters.filter, ...filter },
                                }));
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
