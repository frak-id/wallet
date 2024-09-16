import { type VariantProps, cva } from "class-variance-authority";
import { type HTMLAttributes, forwardRef } from "react";
import styles from "./index.module.css";

interface ColumnsProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof columnsVariants> {}

const columnsVariants = cva(styles.columns, {
    variants: {
        size: {
            full: styles["column--full"],
            threeQuarter: styles["column--3-4"],
            oneQuarter: styles["column--1-4"],
        },
        align: {
            start: styles["columns--align-start"],
            center: styles["columns--align-center"],
        },
    },
    defaultVariants: {
        align: "center",
    },
});

export const Columns = forwardRef<HTMLDivElement, ColumnsProps>(
    ({ className, size, align, ...props }, ref) => {
        return (
            <div
                className={columnsVariants({
                    size,
                    align,
                    className,
                })}
                ref={ref}
                {...props}
            />
        );
    }
);
Columns.displayName = "Columns";

interface ColumnProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof columnVariants> {}

const columnVariants = cva(styles.column, {
    variants: {
        size: {
            full: styles["column--full"],
            threeQuarter: styles["column--3-4"],
            oneQuarter: styles["column--1-4"],
        },
    },
});

export const Column = forwardRef<HTMLDivElement, ColumnProps>(
    ({ className, size, ...props }, ref) => {
        return (
            <div
                className={columnVariants({
                    size,
                    className,
                })}
                ref={ref}
                {...props}
            />
        );
    }
);
Column.displayName = "Column";
