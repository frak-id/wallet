import clsx from "clsx";
import type {
    ButtonHTMLAttributes,
    ComponentProps,
    ComponentPropsWithRef,
    ReactNode,
} from "react";
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
        className={clsx(pagination, className)}
        {...props}
    />
);
Pagination.displayName = "Pagination";

const PaginationContent = ({
    ref,
    className,
    ...props
}: ComponentPropsWithRef<"ul">) => (
    <ul ref={ref} className={clsx(paginationContent, className)} {...props} />
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

type PaginationLinkProps = Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "size"
> & {
    isActive?: boolean;
    children?: ReactNode;
    size?: "small" | "medium" | "large" | "none";
};

const PaginationLink = ({
    className,
    isActive,
    children,
    ...props
}: PaginationLinkProps) => (
    <Button
        variant="ghost"
        size={"none"}
        className={clsx(
            paginationLink,
            isActive && paginationLinkActive,
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
        className={clsx(paginationLink, className)}
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
        className={clsx(paginationLink, className)}
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
        className={clsx(paginationLink, paginationMore, className)}
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
