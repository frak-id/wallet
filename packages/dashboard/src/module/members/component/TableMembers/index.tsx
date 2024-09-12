"use client";

import { getProductMembers } from "@/context/members/action/getProductMembers";
import type { ReactTableProps } from "@/module/common/component/Table";
import type { MembersPageItem } from "@/types/Members";
import { WalletAddress } from "@module/component/HashDisplay";
import { Skeleton } from "@module/component/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import dynamic from "next/dynamic";
import { useMemo } from "react";
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
    const { data: page, isPending } = useQuery({
        queryKey: ["members", "page"],
        queryFn: async () => {
            return await getProductMembers({ limit: 10, offset: 0 });
        },
    });

    // Build our columns
    const columns = useMemo(
        () =>
            [
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
        page && (
            <>
                <Table data={page.members} columns={columns} />
            </>
        )
    );
}
