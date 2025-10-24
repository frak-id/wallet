"use client";

import { Button } from "@frak-labs/ui/component/Button";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { MembersFiltering } from "@/module/members/component/MembersFiltering";
import { FiltersCount } from "@/module/members/component/TableMembers/FiltersCount";
import { membersStore } from "@/stores/membersStore";
import styles from "./Filters.module.css";

export function TableMembersFilters() {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const tableMembersFilters = membersStore((state) => state.tableFilters);
    const setTableMembersFilters = membersStore(
        (state) => state.setTableFilters
    );

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
                            Filters{" "}
                            <FiltersCount filter={tableMembersFilters.filter} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        onEscapeKeyDown={() => setIsPopoverOpen(false)}
                        className={styles.filters__popoverContent}
                    >
                        <MembersFiltering
                            initialValue={tableMembersFilters.filter}
                            onFilterSet={(filter) => {
                                setTableMembersFilters((filters) => ({
                                    ...filters,
                                    filter: { ...filters.filter, ...filter },
                                }));
                            }}
                            showResetButton={true}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
