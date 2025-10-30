import type { SortingState, TableOptions } from "@tanstack/react-table";
import {
    type Column,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type PaginationState,
    type RowPinningState,
    type RowSelectionState,
    useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { type PropsWithChildren, useMemo, useState } from "react";
import styles from "./index.module.css";

export type ReactTableProps<TData> = {
    classNameWrapper?: string;
    className?: string;
    preTable?: ReactNode;
    postTable?: ReactNode;
    // Some custom configs
    enableFiltering?: boolean;
    // Some states
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    rowSelection?: RowSelectionState;
    rowPinning?: RowPinningState;
    pagination?: PaginationState;
} & Omit<
    TableOptions<TData>,
    "state" | "getCoreRowModel" | "getSortedRowModel" | "getFilteredRowModel"
>;

export function Table<TData extends object>({
    data,
    columns,
    classNameWrapper = "",
    className = "",
    preTable,
    postTable,
    sorting,
    enableFiltering = false,
    columnFilters,
    rowSelection,
    rowPinning,
    pagination,
    ...additionalProps
}: ReactTableProps<TData>) {
    const [sortingInner, setSortingInner] = useState<SortingState>([]);

    /**
     * Build the table instance
     */
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting: sorting ?? sortingInner,
            columnFilters,
            rowSelection,
            rowPinning,
            pagination,
        },
        onSortingChange: setSortingInner,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: additionalProps.enableSorting
            ? getSortedRowModel()
            : undefined,
        getFilteredRowModel: enableFiltering
            ? getFilteredRowModel()
            : undefined,
        ...additionalProps,
    });

    const rowModel = table.getRowModel();
    const footerGroups = table.getFooterGroups();
    const hasFooters = useMemo(
        () =>
            footerGroups.some((group) =>
                group.headers.some((header) =>
                    Boolean(header.column.columnDef.footer)
                )
            ),
        [footerGroups]
    );

    return (
        <div className={`${styles.tableWrapper} ${classNameWrapper}`}>
            {preTable && <div className={styles.preTable}>{preTable}</div>}

            <table className={`${styles.table} ${className}`}>
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th key={header.id}>
                                    {header.isPlaceholder ? null : (
                                        <Sorting {...header.column}>
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                        </Sorting>
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>

                <tbody>
                    {rowModel.rows.length === 0 ? (
                        <tr>
                            <td colSpan={table.options.columns.length}>
                                No results
                            </td>
                        </tr>
                    ) : (
                        rowModel.rows.map((row) => (
                            <tr key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>

                {hasFooters && (
                    <tfoot>
                        {footerGroups.map((footerGroup) => (
                            <tr key={footerGroup.id}>
                                {footerGroup.headers.map((header) => (
                                    <th key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .footer,
                                                  header.getContext()
                                              )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </tfoot>
                )}
            </table>

            {postTable}
        </div>
    );
}

/**
 * Sorting wrapper for headers
 * @param children
 * @param column
 * @constructor
 */
function Sorting<TData>({
    children,
    ...column
}: PropsWithChildren<Column<TData, unknown>>) {
    if (!column.getCanSort()) {
        return <span>{children}</span>;
    }
    const isSorted = column.getIsSorted();
    const Icon =
        isSorted === false
            ? ArrowDownUp
            : isSorted === "asc"
              ? ArrowUp
              : ArrowDown;
    return (
        <button
            className={styles.table__button}
            type={"button"}
            onClick={column.getToggleSortingHandler()}
        >
            {children}
            {Icon && <Icon className={styles.table__filterIcon} />}
        </button>
    );
}
