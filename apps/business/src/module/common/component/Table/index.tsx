import { ArrowUpIcon } from "@frak-labs/design-system/icons";
import type { SortingState, TableOptions } from "@tanstack/react-table";
import {
    type Column,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type PaginationState,
    type Row,
    type RowPinningState,
    type RowSelectionState,
    useReactTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import type { ReactNode } from "react";
import { type PropsWithChildren, useMemo, useState } from "react";
import {
    preTable as preTableStyle,
    tableButton,
    tableFilterIcon,
    tableFilterIconDesc,
    table as tableStyle,
    tableWrapper,
} from "./table.css";

export type ReactTableProps<TData> = {
    classNameWrapper?: string;
    className?: string;
    preTable?: ReactNode;
    postTable?: ReactNode;
    // Some custom configs
    enableFiltering?: boolean;
    onRowClick?: (row: Row<TData>) => void;
    // Some states
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    rowSelection?: RowSelectionState;
    rowPinning?: RowPinningState;
    pagination?: PaginationState;
    /**
     * Per-row data-* attributes. Each entry maps an attribute name (e.g.
     * `data-selected`) to a function returning its stringified value (or
     * undefined to omit). Used to drive row-level visual states from CSS
     * without polluting the column definitions.
     */
    rowDataAttributes?: Record<string, (row: Row<TData>) => string | undefined>;
    /**
     * Whether any row in the dataset is currently selected. When true the
     * table receives `data-any-selected="true"` so unselected rows can be
     * dimmed via CSS.
     */
    anySelected?: boolean;
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
    onRowClick,
    columnFilters,
    rowSelection,
    rowPinning,
    pagination,
    rowDataAttributes,
    anySelected,
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
        <div className={clsx(tableWrapper, classNameWrapper)}>
            {preTable && <div className={preTableStyle}>{preTable}</div>}

            <table
                className={clsx(tableStyle, className)}
                data-any-selected={anySelected ? "true" : undefined}
            >
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
                        rowModel.rows.map((row) => {
                            const extraAttrs = rowDataAttributes
                                ? Object.fromEntries(
                                      Object.entries(rowDataAttributes)
                                          .map(([name, fn]) => [name, fn(row)])
                                          .filter(
                                              ([, value]) => value !== undefined
                                          )
                                  )
                                : undefined;
                            return (
                                <tr
                                    key={row.id}
                                    data-clickable={
                                        onRowClick ? "true" : undefined
                                    }
                                    onClick={
                                        onRowClick
                                            ? () => onRowClick(row)
                                            : undefined
                                    }
                                    {...extraAttrs}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
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
    const isSortedDesc = column.getIsSorted() === "desc";
    return (
        <button
            className={tableButton}
            type={"button"}
            onClick={column.getToggleSortingHandler()}
        >
            {children}
            <ArrowUpIcon
                className={clsx(
                    tableFilterIcon,
                    isSortedDesc && tableFilterIconDesc
                )}
            />
        </button>
    );
}
