"use client";

import { getProductMembers } from "@/context/members/action/getProductMembers";
import type { ReactTableProps } from "@/module/common/component/Table";
import { tableMembersFiltersAtom } from "@/module/members/atoms/tableMembers";
import { TableMembersFilters } from "@/module/members/component/TableMembers/Filters";
import { Pagination } from "@/module/members/component/TableMembers/Pagination";
import type { MembersPageItem } from "@/types/Members";
import { WalletAddress } from "@module/component/HashDisplay";
import { Skeleton } from "@module/component/Skeleton";
import { Checkbox } from "@module/component/forms/Checkbox";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
    type ColumnDef,
    type RowSelectionState,
    createColumnHelper,
} from "@tanstack/react-table";
import { useAtomValue } from "jotai";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { formatEther } from "viem";

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
    const [selectedRow, setSelectedRow] = useState<RowSelectionState>({});

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
                    cell: ({ row }) => (
                        <Checkbox
                            id={`select-${row.id}`}
                            checked={row.getIsSelected()}
                            onCheckedChange={row.getToggleSelectedHandler()}
                            disabled={!row.getCanSelect()}
                        />
                    ),
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
        []
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
                    enableRowSelection={false}
                    onRowSelectionChange={setSelectedRow}
                    rowSelection={selectedRow}
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
