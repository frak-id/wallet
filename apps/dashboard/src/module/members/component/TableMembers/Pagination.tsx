import { useCallback } from "react";
import { TablePagination } from "@/module/common/component/TablePagination";
import { membersStore } from "@/stores/membersStore";

export function Pagination({ totalResult }: { totalResult: number }) {
    const filters = membersStore((state) => state.tableFilters);
    const setFilters = membersStore((state) => state.setTableFilters);

    const handlePageChange = useCallback(
        (page: number) =>
            setFilters?.((prevState) => ({
                ...prevState,
                offset: (page - 1) * (prevState?.limit ?? 10),
            })),
        [setFilters]
    );

    return (
        <TablePagination
            onPageChange={handlePageChange}
            totalItems={totalResult}
            page={(filters.offset ?? 0) / (filters.limit ?? 10) + 1}
            itemsPerPage={filters.limit ?? 10}
        />
    );
}
