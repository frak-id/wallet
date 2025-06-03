import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/module/common/component/Pagination";
import usePagination from "@lucasmogari/react-pagination";
import styles from "./index.module.css";

type TablePaginationProps = {
    onPageChange: (page: number) => void;
    maxPageItems?: number;
    totalItems: number;
    page: number;
    itemsPerPage: number;
};

export function TablePagination({
    onPageChange,
    totalItems,
    page,
    itemsPerPage,
    maxPageItems = 7,
}: TablePaginationProps) {
    const { getPageItem, size, fromItem, toItem } = usePagination({
        totalItems,
        page,
        itemsPerPage,
        maxPageItems,
        getPageItemProps: (_pageItemIndex, page, props) => {
            const defaultOnClick = props.onClick;
            // Overwriting onClick
            props.onClick = (e) => {
                onPageChange(page as number);
                defaultOnClick?.(e);
            };
            return {};
        },
    });

    return (
        <div className={styles.pagination}>
            <p>
                Showing {fromItem}-{toItem} from {totalItems}
            </p>
            <Pagination>
                <PaginationContent>
                    {[...Array(size)].map((_, index) => {
                        const { page, disabled, current, props } =
                            getPageItem(index);

                        if (page === "previous") {
                            return (
                                <PaginationItem key={page}>
                                    <PaginationPrevious
                                        disabled={disabled}
                                        {...props}
                                        aria-current={false}
                                    />
                                </PaginationItem>
                            );
                        }

                        if (page === "gap") {
                            return (
                                <PaginationItem
                                    key={`gap-${page}-${index + 1}`}
                                >
                                    <PaginationEllipsis />
                                </PaginationItem>
                            );
                        }

                        if (page === "next") {
                            return (
                                <PaginationItem key={page}>
                                    <PaginationNext
                                        disabled={disabled}
                                        {...props}
                                        aria-current={false}
                                    />
                                </PaginationItem>
                            );
                        }

                        return (
                            <PaginationItem key={page}>
                                <PaginationLink
                                    isActive={current}
                                    {...props}
                                    aria-current={current ? "page" : undefined}
                                >
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        );
                    })}
                </PaginationContent>
            </Pagination>
        </div>
    );
}
