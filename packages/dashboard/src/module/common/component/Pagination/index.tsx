import { Button } from "@module/component/Button";
import { cx } from "class-variance-authority";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { type ComponentProps, type ReactNode, forwardRef } from "react";
import styles from "./index.module.css";

const Pagination = ({ className, ...props }: ComponentProps<"nav">) => (
    <nav
        role="navigation"
        aria-label="pagination"
        className={`${styles.pagination} ${className}`}
        {...props}
    />
);
Pagination.displayName = "Pagination";

const PaginationContent = forwardRef<HTMLUListElement, ComponentProps<"ul">>(
    ({ className, ...props }, ref) => (
        <ul
            ref={ref}
            className={`${styles.pagination__content} ${className}`}
            {...props}
        />
    )
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
    ({ className, ...props }, ref) => (
        <li ref={ref} className={className} {...props} />
    )
);
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
    isActive?: boolean;
    children?: ReactNode;
} & ComponentProps<typeof Button>;

const PaginationLink = ({
    className,
    isActive,
    children,
    ...props
}: PaginationLinkProps) => (
    <Button
        variant="ghost"
        size={"none"}
        className={cx(
            styles.pagination__link,
            isActive && styles["pagination__link--active"],
            className
        )}
        {...props}
    >
        {children}
    </Button>
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
    className,
    ...props
}: ComponentProps<typeof PaginationLink>) => (
    <PaginationLink
        aria-label="Go to previous page"
        size="none"
        className={`${styles.pagination__link} ${className}`}
        {...props}
    >
        <ChevronLeft size={20} />
    </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({
    className,
    ...props
}: ComponentProps<typeof PaginationLink>) => (
    <PaginationLink
        aria-label="Go to next page"
        size="none"
        className={`${styles.pagination__link} ${className}`}
        {...props}
    >
        <ChevronRight size={20} />
    </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({
    className,
    ...props
}: ComponentProps<"span">) => (
    <span
        aria-hidden
        className={`${styles.pagination__link} ${styles.pagination__more} ${className}`}
        {...props}
    >
        <MoreHorizontal size={20} />
        <span className="sr-only">More pages</span>
    </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
};
