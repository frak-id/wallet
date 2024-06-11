import { TablePagination } from "@/module/common/component/TablePagination";
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import useSessionStorageState from "use-session-storage-state";
import styles from "./index.module.css";

type TableFiltering = {
    page: number;
    field?: string;
    order?: string;
};

export type ReactTableProps<TData, TMetas> = {
    data: TData[];
    metas?: TMetas;
    columns: ColumnDef<TData>[];
    pagination?: boolean;
    classNameWrapper?: string;
    className?: string;
    link?: string;
    filtering?: TableFiltering;
    setFiltering?: Dispatch<SetStateAction<TableFiltering>>;
    limit?: number;
};

type Metas = {
    page: number;
    limit: number;
    firstPage?: string;
    lastPage?: string;
    nextPage?: string;
    previousPage?: string;
    totalPages?: number;
    totalResults?: number;
};

export function Table<TData extends object, TMetas extends Metas>({
    data,
    metas,
    columns,
    pagination = true,
    classNameWrapper = "",
    className = "",
    filtering,
    setFiltering,
    limit,
}: ReactTableProps<TData, TMetas>) {
    const [, setSessionStorageFiltering] = useSessionStorageState<{
        page: number;
        field?: string;
        order?: string;
    }>("table-filtering", {
        defaultValue: { page: 1, field: undefined, order: undefined },
    });
    const { /* limit, totalPages,*/ totalResults } = metas ?? {};
    const [sorting, setSorting] = useState<SortingState>([]);
    const [rowSelection, setRowSelection] = useState({});
    const totalItems = totalResults ?? data.length;

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            rowSelection,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    function handlePageChange(page: number) {
        if (!page) {
            return;
        }
        setFiltering?.((prevState) => {
            setTimeout(() => {
                setSessionStorageFiltering({
                    page,
                    field: prevState.field,
                    order: prevState.order,
                });
            }, 100);
            return { page, field: prevState.field, order: prevState.order };
        });
    }

    function handleSortingChange(field: string) {
        setFiltering?.((prevState) => {
            if (prevState.field === field) {
                setSessionStorageFiltering({
                    page: 1,
                    field,
                    order: prevState.order === "asc" ? "desc" : "asc",
                });
                return {
                    page: 1,
                    field,
                    order: prevState.order === "asc" ? "desc" : "asc",
                };
            }
            setSessionStorageFiltering({ page: 1, field, order: "asc" });
            return { page: 1, field, order: "asc" };
        });
    }

    useEffect(() => {
        limit && table.setPageSize(limit);
    }, [table, limit]);

    type TagProps = {
        canSort: boolean;
        field: string;
        children: ReactNode;
    };

    function Sorting({ canSort, field, children, ...props }: TagProps) {
        const Tag = canSort ? "button" : "span";
        const Icon =
            filtering?.field === field && filtering?.order === "asc"
                ? ChevronUp
                : ChevronDown;
        return (
            <Tag className={styles.table__button} {...props}>
                {children}
                {canSort && <Icon className={styles.table__filterIcon} />}
            </Tag>
        );
    }

    const rowModel = table.getRowModel();
    const footerGroups = table.getFooterGroups();
    const hasFooters = useMemo(() => {
        return footerGroups.some((group) =>
            group.headers.some((header) =>
                Boolean(header.column.columnDef.footer)
            )
        );
    }, [footerGroups]);

    return (
        <>
            <div className={`${styles.tableWrapper} ${classNameWrapper}`}>
                <table className={`${styles.table} ${className}`}>
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th key={header.id}>
                                        {header.isPlaceholder ? null : (
                                            <Sorting
                                                canSort={header.column.getCanSort()}
                                                {...{
                                                    field: header.column.id,
                                                    onClick: () => {
                                                        header.column.getCanSort() &&
                                                            handleSortingChange(
                                                                header.column.id
                                                            );
                                                    },
                                                }}
                                            >
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
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
                {pagination && (
                    <TablePagination
                        onPageChange={handlePageChange}
                        totalItems={totalItems}
                        page={filtering?.page ?? 1}
                        itemsPerPage={limit ?? 10}
                    />
                )}
            </div>
        </>
    );
}
