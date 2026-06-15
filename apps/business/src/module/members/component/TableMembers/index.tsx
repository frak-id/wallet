import { formatAmount } from "@frak-labs/core-sdk";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
    type ColumnDef,
    createColumnHelper,
    type SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
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
import { currencyStore } from "@/stores/currencyStore";
import { membersStore } from "@/stores/membersStore";

const columnHelper = createColumnHelper<GetMembersPageItem>();

/**
 * Table of all the members components
 *  - tanstack table
 *  - filter on top
 */
export function TableMembers() {
    const { t } = useTranslation();
    const filters = membersStore((state) => state.tableFilters);
    const setFilters = membersStore((state) => state.setTableFilters);
    const isDemoMode = useIsDemoMode();
    const merchantId = useActiveMerchantId();
    const currency = currencyStore((state) => state.preferredCurrency);

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
        ...membersPageQueryOptions({
            merchantId,
            filters,
            isDemoMode,
            currency,
        }),
        placeholderData: keepPreviousData,
    });

    // Build our columns
    const columns = useMemo(
        () =>
            [
                columnHelper.accessor("user", {
                    enableSorting: true,
                    header: () => t("members.columns.wallet"),
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
                    header: () => t("members.columns.merchants"),
                    cell: ({ getValue }) => getValue().join(", "),
                }),
                columnHelper.accessor("firstInteractionTimestamp", {
                    enableSorting: true,
                    header: () => t("members.columns.memberFrom"),
                    cell: ({ getValue }) =>
                        new Date(
                            Number.parseInt(getValue(), 10) * 1000
                        ).toLocaleDateString(),
                }),
                columnHelper.accessor("totalInteractions", {
                    enableSorting: true,
                    header: () => t("members.columns.interactions"),
                    cell: ({ getValue }) => getValue(),
                }),
                columnHelper.accessor("totalRewardsFiat", {
                    enableSorting: true,
                    header: () =>
                        t("members.columns.rewards", {
                            currency: currency.toUpperCase(),
                        }),
                    cell: ({ getValue }) => formatAmount(getValue(), currency),
                }),
            ] as ColumnDef<GetMembersPageItem>[],
        [currency, t]
    );

    if (!page || isPending) {
        return <Skeleton variant="rect" height={250} />;
    }

    return (
        <>
            <Stack space="l">
                <TableMembersFilters />
                {page && (
                    <Table
                        data={page.members}
                        columns={columns}
                        emptyPlaceholder="–"
                        manualPagination={true}
                        manualSorting={true}
                        rowCount={page.totalResult}
                        pagination={paginationState}
                        sorting={sortingState}
                        onSortingChange={setSorting}
                        onRowClick={(row) => setSelectedMember(row.original)}
                        postTable={
                            page.totalResult > (filters.limit ?? 10) && (
                                <Pagination totalResult={page.totalResult} />
                            )
                        }
                    />
                )}
            </Stack>
            <MemberDetailsSheet
                member={selectedMember}
                onOpenChange={(open) =>
                    setSelectedMember(open ? selectedMember : undefined)
                }
            />
        </>
    );
}
