import type {
    ColumnDef,
    ColumnFiltersState,
    PaginationState,
    SortingState,
    Table,
    TableOptions,
} from "@tanstack/react-table";
import {
    type Column,
    columnFilteringFeature,
    columnSizingFeature,
    columnVisibilityFeature,
    createColumnHelper,
    createFilteredRowModel,
    createSortedRowModel,
    filterFn_includesString,
    flexRender,
    type Row,
    rowPaginationFeature,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_basic,
    sortFn_datetime,
    sortFn_text,
    tableFeatures,
    useTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import type { ReactNode } from "react";
import { type PropsWithChildren, useMemo, useState } from "react";
import { ArrowUpIcon } from "../../icons";
import {
    cell as tableCell,
    headerCell as tableHeaderCell,
} from "../Table/table.css";
import { Text } from "../Text";
import {
    preTable as preTableStyle,
    tableButton,
    tableButtonEnd,
    tableFilterIcon,
    tableFilterIconDesc,
    tableFixedLayout,
    table as tableStyle,
    tableWrapper,
} from "./data-table.css";

/**
 * Row-model factories must sit on `features`; `manualSorting`/`manualFiltering`
 * gate them per instance. `filterFns`/`sortFns` too: a column defaulting to
 * `"auto"` resolves a built-in by name, and an unregistered name silently drops
 * the filter or downgrades sorting to a codepoint compare.
 */
const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,
    columnVisibilityFeature,
    columnSizingFeature,
    sortedRowModel: createSortedRowModel(),
    filteredRowModel: createFilteredRowModel(),
    filterFns: { includesString: filterFn_includesString },
    sortFns: {
        alphanumeric: sortFn_alphanumeric,
        basic: sortFn_basic,
        datetime: sortFn_datetime,
        text: sortFn_text,
    },
});

declare module "@tanstack/react-table" {
    interface ColumnMeta<TFeatures, TData, TValue> {
        align?: "left" | "right";
    }
}

/**
 * Consumers name only their data type, never `typeof features` — which stays
 * unexported so nobody constructs a table instance directly.
 */
export type DataTableColumnDef<TData extends object> = ColumnDef<
    typeof features,
    TData
>;
export type DataTableRow<TData extends object> = Row<typeof features, TData>;
export type DataTableColumn<TData extends object> = Column<
    typeof features,
    TData
>;
export type DataTableTable<TData extends object> = Table<
    typeof features,
    TData
>;

export function createDataTableColumnHelper<TData extends object>() {
    return createColumnHelper<typeof features, TData>();
}

export type DataTableProps<TData extends object> = {
    classNameWrapper?: string;
    className?: string;
    preTable?: ReactNode;
    postTable?: ReactNode;
    /** Translated by the consumer; the design system is app-agnostic. */
    emptyMessage: ReactNode;
    /**
     * Renders the empty state as a full data row — message in the first column,
     * this placeholder in the rest — instead of one cell spanning all columns.
     */
    emptyPlaceholder?: ReactNode;
    enableFiltering?: boolean;
    onRowClick?: (row: DataTableRow<TData>) => void;
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;
    pagination?: PaginationState;
    /**
     * Per-row `data-*` attributes, each mapping a name to a function returning
     * its value or undefined to omit. Drives row state from CSS.
     */
    rowDataAttributes?: Record<
        string,
        (row: DataTableRow<TData>) => string | undefined
    >;
    /** Sets `data-any-selected` so unselected rows can dim via CSS. */
    anySelected?: boolean;
    /**
     * `table-layout: fixed` so widths come from `size`, not content. A cell
     * with `overflow: hidden` then truncates at its computed width.
     */
    fixedLayout?: boolean;
} & Omit<TableOptions<typeof features, TData>, "state" | "features">;

export function DataTable<TData extends object>({
    data,
    columns,
    classNameWrapper = "",
    className = "",
    preTable,
    postTable,
    emptyMessage,
    emptyPlaceholder,
    sorting,
    enableFiltering = false,
    onRowClick,
    columnFilters,
    pagination,
    rowDataAttributes,
    anySelected,
    fixedLayout,
    ...additionalProps
}: DataTableProps<TData>) {
    const [sortingInner, setSortingInner] = useState<SortingState>([]);

    const table = useTable({
        features,
        data,
        columns,
        state: {
            sorting: sorting ?? sortingInner,
            columnFilters,
            pagination,
        },
        onSortingChange: setSortingInner,
        manualSorting: !additionalProps.enableSorting,
        manualFiltering: !enableFiltering,
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
                className={clsx(
                    tableStyle,
                    fixedLayout && tableFixedLayout,
                    className
                )}
                data-any-selected={anySelected ? "true" : undefined}
            >
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                const size = header.column.columnDef.size;
                                const align =
                                    header.column.columnDef.meta?.align;
                                return (
                                    <th
                                        key={header.id}
                                        scope="col"
                                        className={tableHeaderCell()}
                                        style={{
                                            ...(size !== undefined && {
                                                width: size,
                                            }),
                                            ...(align === "right" && {
                                                textAlign: "right",
                                            }),
                                        }}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <Sorting column={header.column}>
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext()
                                                )}
                                            </Sorting>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>

                <tbody>
                    {rowModel.rows.length === 0 ? (
                        emptyPlaceholder !== undefined ? (
                            <EmptyRow
                                columns={table.getVisibleLeafColumns()}
                                message={emptyMessage}
                                placeholder={emptyPlaceholder}
                            />
                        ) : (
                            <tr>
                                <td
                                    className={tableCell()}
                                    colSpan={
                                        table.getVisibleLeafColumns().length
                                    }
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        )
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
                                    {row.getVisibleCells().map((cell) => {
                                        const size = cell.column.columnDef.size;
                                        const align =
                                            cell.column.columnDef.meta?.align;
                                        return (
                                            <td
                                                key={cell.id}
                                                className={tableCell()}
                                                style={{
                                                    ...(size !== undefined && {
                                                        width: size,
                                                    }),
                                                    ...(align === "right" && {
                                                        textAlign: "right",
                                                    }),
                                                }}
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </td>
                                        );
                                    })}
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
                                    <th key={header.id} scope="col">
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
 * Keeps the column grid visible: message in the first accessor column,
 * placeholder in other data columns, display columns blank.
 */
function EmptyRow<TData extends object>({
    columns,
    message,
    placeholder,
}: {
    columns: DataTableColumn<TData>[];
    message: ReactNode;
    placeholder: ReactNode;
}) {
    const firstDataIndex = columns.findIndex(
        (column) => typeof column.accessorFn === "function"
    );
    return (
        <tr>
            {columns.map((column, index) => {
                const size = column.columnDef.size;
                const align = column.columnDef.meta?.align;
                const isData = typeof column.accessorFn === "function";
                return (
                    <td
                        key={column.id}
                        className={tableCell()}
                        style={{
                            ...(size !== undefined && { width: size }),
                            ...(align === "right" && { textAlign: "right" }),
                        }}
                    >
                        {isData ? (
                            <Text
                                as="span"
                                variant="bodySmall"
                                color="tertiary"
                            >
                                {index === firstDataIndex
                                    ? message
                                    : placeholder}
                            </Text>
                        ) : null}
                    </td>
                );
            })}
        </tr>
    );
}

function Sorting<TData extends object>({
    children,
    column,
}: PropsWithChildren<{ column: DataTableColumn<TData> }>) {
    if (!column.getCanSort()) {
        return <span>{children}</span>;
    }
    const isSortedDesc = column.getIsSorted() === "desc";
    const align = column.columnDef.meta?.align;
    return (
        <button
            className={clsx(tableButton, align === "right" && tableButtonEnd)}
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
