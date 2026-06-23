import clsx from "clsx";
import type { ComponentProps } from "react";
import { cell, headerCell, table, wrapper } from "./table.css";

type Align = "left" | "center" | "right";

type TableProps = ComponentProps<"table"> & {
    /** Class for the bordered, rounded wrapper around the `<table>`. */
    wrapperClassName?: string;
};

/**
 * Data table styled to the design-system table spec: bordered 12px-radius
 * wrapper, 48px tertiary header row, 56px rows with subtle dividers.
 * Compose with `TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`.
 */
export function Table({ wrapperClassName, className, ...rest }: TableProps) {
    return (
        <div className={clsx(wrapper, wrapperClassName)}>
            <table className={clsx(table, className)} {...rest} />
        </div>
    );
}

export function TableHeader(props: ComponentProps<"thead">) {
    return <thead {...props} />;
}

export function TableBody(props: ComponentProps<"tbody">) {
    return <tbody {...props} />;
}

export function TableRow(props: ComponentProps<"tr">) {
    return <tr {...props} />;
}

type TableHeadProps = ComponentProps<"th"> & {
    align?: Align;
    /** Shrink the column to its widest content. */
    hug?: boolean;
};

export function TableHead({ align, hug, className, ...rest }: TableHeadProps) {
    return (
        <th
            scope="col"
            className={clsx(headerCell({ align, hug }), className)}
            {...rest}
        />
    );
}

type TableCellProps = ComponentProps<"td"> & {
    align?: Align;
    /** Shrink the column to its widest content. */
    hug?: boolean;
    /** Secondary text color, e.g. empty states. */
    muted?: boolean;
};

export function TableCell({
    align,
    hug,
    muted,
    className,
    ...rest
}: TableCellProps) {
    return (
        <td
            className={clsx(cell({ align, hug, muted }), className)}
            {...rest}
        />
    );
}
