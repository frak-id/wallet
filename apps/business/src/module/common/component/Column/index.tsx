import type { PropsWithChildren } from "react";
import { column, columnFullWidth } from "./column.css";

type ColumnProps = {
    fullWidth?: boolean;
    className?: string;
};

export function Column({
    fullWidth = false,
    className = "",
    children,
}: PropsWithChildren<ColumnProps>) {
    return (
        <div
            className={`${column}${fullWidth ? ` ${columnFullWidth}` : ""}${className ? ` ${className}` : ""}`}
            data-fullwidth={fullWidth || undefined}
        >
            {children}
        </div>
    );
}
