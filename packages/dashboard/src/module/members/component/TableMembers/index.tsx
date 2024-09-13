"use client";

import { getProductMembers } from "@/context/members/action/getProductMembers";
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
import { WalletAddress } from "@module/component/HashDisplay";
import { Skeleton } from "@module/component/Skeleton";
import { Checkbox } from "@module/component/forms/Checkbox";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { useAtomValue } from "jotai";
import { useSetAtom } from "jotai/index";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { formatEther, isAddressEqual } from "viem";

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
    const filters = useAtomValue(tableMembersFiltersAtom);
    const selectedMembers = useAtomValue(selectedMembersAtom);
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
                    enableSorting: true,
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
                        `${formatEther(BigInt(getValue()))} mUSD`,
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
                    rowCount={page.totalResult}
                    pagination={paginationState}
                    postTable={
                        page.totalResult > (filters.limit ?? 10) && (
                            <Pagination totalResult={page.totalResult} />
                        )
                    }
                />
            )}
        </>
    );
}
