import { formatAmount } from "@frak-labs/core-sdk";
import { Box } from "@frak-labs/design-system/components/Box";
import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
    type ColumnDef,
    createColumnHelper,
    type SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { isAddressEqual } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { WalletAddress } from "@/module/common/component/HashDisplay";
import { Table } from "@/module/common/component/Table";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import type {
    GetMembersPageItem,
    GetMembersParam,
} from "@/module/members/api/getMerchantMembers";
import { MemberDetailsSheet } from "@/module/members/component/MemberDetailsSheet";
import { TableMembersFilters } from "@/module/members/component/TableMembers/Filters";
import { Pagination } from "@/module/members/component/TableMembers/Pagination";
import { membersPageQueryOptions } from "@/module/members/queries/queryOptions";
import { membersStore } from "@/stores/membersStore";
import * as styles from "./table-members.css";

const columnHelper = createColumnHelper<GetMembersPageItem>();

/**
 * Table of all the members components
 *  - tanstack table
 *  - filter on top
 */
export function TableMembers() {
    const filters = membersStore((state) => state.tableFilters);
    const setFilters = membersStore((state) => state.setTableFilters);
    const selectedMembers = membersStore((state) => state.selectedMembers);
    const addSelectedMember = membersStore((state) => state.addMember);
    const removeSelectedMember = membersStore((state) => state.removeMember);
    const clearSelection = membersStore((state) => state.clearSelection);
    const isDemoMode = useIsDemoMode();
    const merchantId = useActiveMerchantId();

    // Reset pagination when the active merchant changes — the previous
    // merchant's page index doesn't carry over to a different dataset
    // and would otherwise land the user on an empty page until they
    // reset manually. Lives in the component (not the route loader) so
    // hover-preloading on the merchant switcher doesn't mutate the
    // currently-viewed list's pagination.
    useEffect(() => {
        setFilters((prev) =>
            prev.offset && prev.offset !== 0 ? { ...prev, offset: 0 } : prev
        );
    }, [merchantId, setFilters]);

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
     * Member currently displayed in the right-side details sheet.
     */
    const [selectedMember, setSelectedMember] = useState<
        GetMembersPageItem | undefined
    >();

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
        ...membersPageQueryOptions({ merchantId, filters, isDemoMode }),
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
                            <div
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                            >
                                <Checkbox
                                    id={`select-${row.id}`}
                                    checked={
                                        !!selectedMembers?.find((a) =>
                                            isAddressEqual(a, row.original.user)
                                        )
                                    }
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            addSelectedMember(
                                                row.original.user
                                            );
                                        } else {
                                            removeSelectedMember(
                                                row.original.user
                                            );
                                        }
                                    }}
                                    disabled={false}
                                />
                            </div>
                        );
                    },
                }),
                columnHelper.accessor("user", {
                    enableSorting: true,
                    header: () => "Wallet",
                    cell: ({ getValue }) => (
                        <span
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        >
                            <WalletAddress wallet={getValue()} />
                        </span>
                    ),
                }),
                columnHelper.accessor("merchantNames", {
                    enableSorting: false,
                    header: () => "Merchants",
                    cell: ({ getValue }) => getValue().join(", "),
                }),
                columnHelper.accessor("firstInteractionTimestamp", {
                    enableSorting: true,
                    header: () => "Member from",
                    cell: ({ getValue }) =>
                        new Date(
                            Number.parseInt(getValue(), 10) * 1000
                        ).toLocaleDateString(),
                }),
                columnHelper.accessor("totalInteractions", {
                    enableSorting: true,
                    header: () => "Interactions",
                    cell: ({ getValue }) => getValue(),
                }),
                columnHelper.accessor("totalRewardsUsd", {
                    enableSorting: true,
                    header: () => "Rewards (USD)",
                    cell: ({ getValue }) => formatAmount(getValue(), "usd"),
                }),
            ] as ColumnDef<GetMembersPageItem>[],
        [selectedMembers, addSelectedMember, removeSelectedMember, isDemoMode]
    );

    if (!page || isPending) {
        return <Skeleton variant="rect" height={250} />;
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
                    onRowClick={(row) => setSelectedMember(row.original)}
                    postTable={
                        <>
                            {(selectedMembers?.length ?? 0) > 0 && (
                                <Box className={styles.selectedMembersRow}>
                                    <Inline space="m" alignY="center">
                                        <p>
                                            You have selected{" "}
                                            <strong>
                                                {selectedMembers?.length}
                                            </strong>{" "}
                                            Members
                                        </p>
                                        <Button
                                            type={"button"}
                                            onClick={() => clearSelection()}
                                            variant={"secondary"}
                                        >
                                            Clear selection
                                        </Button>
                                    </Inline>
                                </Box>
                            )}

                            {page.totalResult > (filters.limit ?? 10) && (
                                <Pagination totalResult={page.totalResult} />
                            )}
                        </>
                    }
                />
            )}
            <MemberDetailsSheet
                member={selectedMember}
                onOpenChange={(open) =>
                    setSelectedMember(open ? selectedMember : undefined)
                }
            />
        </>
    );
}
