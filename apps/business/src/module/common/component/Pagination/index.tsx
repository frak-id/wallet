import type { ComponentProps, ComponentPropsWithRef, ReactNode } from "react";
import { Button } from "@/module/common/component/Button";
import {
    pagination,
    paginationContent,
    paginationLink,
    paginationLinkActive,
    paginationMore,
} from "./pagination.css";

const Pagination = ({ className, ...props }: ComponentProps<"nav">) => (
    <nav
        aria-label="pagination"
        className={`${pagination}${className ? ` ${className}` : ""}`}
        {...props}
    />
);
Pagination.displayName = "Pagination";

const PaginationContent = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<"ul">) => (
    <ul
        ref={ref}
        className={`${paginationContent}${className ? ` ${className}` : ""}`}
        {...props}
    />
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<"li">) => (
    <li ref={ref} className={className} {...props} />
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
        className={`${paginationLink}${isActive ? ` ${paginationLinkActive}` : ""}${className ? ` ${className}` : ""}`}
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
        className={`${paginationLink}${className ? ` ${className}` : ""}`}
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
        className={`${paginationLink}${className ? ` ${className}` : ""}`}
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
        className={`${paginationLink} ${paginationMore}${className ? ` ${className}` : ""}`}
        {...props}
    >
        <MoreHorizontal size={20} />
        <span className="sr-only">More pages</span>
    </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

export {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
};
