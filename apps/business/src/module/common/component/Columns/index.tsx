import type { ComponentPropsWithRef } from "react";
import { column, columnRoot, columns, columnsRoot } from "./columns.css";

type ColumnsAlign = "start" | "center";

type ColumnsProps = ComponentPropsWithRef<"div"> & {
    align?: ColumnsAlign;
};

export const Columns = ({ ref, className, align, ...props }: ColumnsProps) => {
    return (
        <div
            className={`${columnsRoot} ${columns({ align })}${className ? ` ${className}` : ""}`}
            ref={ref}
            {...props}
        />
    );
};
Columns.displayName = "Columns";

type ColumnSize = "none" | "full" | "threeQuarter" | "oneQuarter";
type ColumnJustify = "start" | "end";

type ColumnProps = ComponentPropsWithRef<"div"> & {
    size?: ColumnSize;
    justify?: ColumnJustify;
};

export const Column = ({
    ref,
    className,
    size,
    justify = "end",
    ...props
}: ColumnProps) => {
    return (
        <div
            className={`${columnRoot} ${column({ size, justify })}${className ? ` ${className}` : ""}`}
            ref={ref}
            data-justify={justify}
            {...props}
        />
    );
};
Column.displayName = "Column";
