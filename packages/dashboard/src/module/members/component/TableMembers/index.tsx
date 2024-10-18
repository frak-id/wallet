"use client";

import {
    type GetMembersParam,
    getProductMembers,
} from "@/context/members/action/getProductMembers";
import { Row } from "@/module/common/component/Row";
import type { ReactTableProps } from "@/module/common/component/Table";
import {
    addSelectedMembersAtom,
    removeSelectedMembersAtom,
    selectedMembersAtom,
} from "@/module/members/atoms/selectedMembers";
import { tableMembersFiltersAtom } from "@/module/members/atoms/tableMembers";
import { TableMembersFilters } from "@/module/members/component/TableMembers/Filters";
import { Pagination } from "@/module/members/component/TableMembers/Pagination";
import type { MembersPageItem } from "@/types/Members";
import { Button } from "@module/component/Button";
import { WalletAddress } from "@module/component/HashDisplay";
import { Skeleton } from "@module/component/Skeleton";
import { Checkbox } from "@module/component/forms/Checkbox";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
    type ColumnDef,
    type SortingState,
    createColumnHelper,
} from "@tanstack/react-table";
import { useAtom, useSetAtom } from "jotai";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { formatEther, isAddressEqual } from "viem";
import styles from "./index.module.css";

const Table = dynamic<ReactTableProps<MembersPageItem>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    {
        loading: () => <Skeleton />,
    }
);

const columnHelper = createColumnHelper<MembersPageItem>();

/**
 * Table of all the members components
 *  - tanstack table
 *  - filter on top
 */
export function TableMembers() {
    const [filters, setFilters] = useAtom(tableMembersFiltersAtom);
    const [selectedMembers, setSelectedMembers] = useAtom(selectedMembersAtom);
    const addSelectedMember = useSetAtom(addSelectedMembersAtom);
    const removeSelectedMember = useSetAtom(removeSelectedMembersAtom);

    /**
     * Replicate pagination state for the table using the filter
     */
    const paginationState = useMemo(() => {
        const { offset, limit } = filters;
        if (!offset || offset === 0) {
            return {
                pageIndex: 0,
                pageSize: limit ?? 10,
            };
        }
        return {
            pageIndex: offset / (limit ?? 10),
            pageSize: limit ?? 10,
        };
    }, [filters]);

    /**
     * Current sorting state of the table
     */
    const [sortingState, setSorting] = useState<SortingState>([]);

    /**
     * Every time sorting state changes, update the filters
     */
    useEffect(() => {
        // Remove the sorting from the filters
        if (sortingState.length === 0) {
            setFilters((filters) => ({
                ...filters,
                sort: undefined,
            }));
            return;
        }

        // Otherwise, pick the first one
        const [sort] = sortingState;
        setFilters((filters) => ({
            ...filters,
            sort: {
                by: sort.id,
                order: sort.desc ? "desc" : "asc",
            } as GetMembersParam["sort"],
        }));
    }, [sortingState, setFilters]);

    const { data: page, isPending } = useQuery({
        queryKey: ["members", "page", filters],
        queryFn: async () => {
            return await getProductMembers(filters);
        },
        placeholderData: keepPreviousData,
    });

    // Build our columns
    const columns = useMemo(
        () =>
            [
                columnHelper.display({
                    id: "select",
                    cell: ({ row }) => {
                        return (
                            <Checkbox
                                id={`select-${row.id}`}
                                checked={
                                    !!selectedMembers?.find((a) =>
                                        isAddressEqual(a, row.original.user)
                                    )
                                }
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        addSelectedMember(row.original.user);
                                    } else {
                                        removeSelectedMember(row.original.user);
                                    }
                                }}
                                disabled={false}
                            />
                        );
                    },
                }),
                columnHelper.accessor("user", {
                    enableSorting: true,
                    header: () => "Wallet",
                    cell: ({ getValue }) => (
                        <WalletAddress wallet={getValue()} />
                    ),
                }),
                columnHelper.accessor("productNames", {
                    enableSorting: false,
                    header: () => "Products",
                    cell: ({ getValue }) => getValue().join(", "),
                }),
                columnHelper.accessor("firstInteractionTimestamp", {
                    enableSorting: true,
                    header: () => "Member from",
                    cell: ({ getValue }) =>
                        new Date(
                            Number.parseInt(getValue()) * 1000
                        ).toLocaleDateString(),
                }),
                columnHelper.accessor("totalInteractions", {
                    enableSorting: true,
                    header: () => "Interactions",
                    cell: ({ getValue }) => getValue(),
                }),
                columnHelper.accessor("rewards", {
                    enableSorting: true,
                    header: () => "Rewards",
                    cell: ({ getValue }) =>
                        `${formatEther(BigInt(getValue()))} $`,
                }),
            ] as ColumnDef<MembersPageItem>[],
        [selectedMembers, addSelectedMember, removeSelectedMember]
    );

    if (!page || isPending) {
        return <Skeleton />;
    }

    return (
        <>
            <TableMembersFilters />
            {page && (
                <Table
                    data={page.members}
                    columns={columns}
                    manualPagination={true}
                    manualSorting={true}
                    rowCount={page.totalResult}
                    pagination={paginationState}
                    sorting={sortingState}
                    onSortingChange={setSorting}
                    postTable={
                        <>
                            {(selectedMembers?.length ?? 0) > 0 && (
                                <>
                                    <Row
                                        align={"center"}
                                        className={styles.selectedMembersRow}
                                    >
                                        <p>
                                            You have selected{" "}
                                            <strong>
                                                {selectedMembers?.length}
                                            </strong>{" "}
                                            Members
                                        </p>
                                        <Button
                                            type={"button"}
                                            onClick={() =>
                                                setSelectedMembers([])
                                            }
                                            variant={"outline"}
                                        >
                                            Clear selection
                                        </Button>
                                    </Row>
                                </>
                            )}

                            {page.totalResult > (filters.limit ?? 10) && (
                                <Pagination totalResult={page.totalResult} />
                            )}
                        </>
                    }
                />
            )}
        </>
    );
}
