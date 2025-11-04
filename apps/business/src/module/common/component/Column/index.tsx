import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type ColumnProps = {
    fullWidth?: boolean;
    className?: string;
};

export function Column({
    fullWidth = false,
    className = "",
    children,
}: PropsWithChildren<ColumnProps>) {
    const classNameFullWidth = fullWidth ? styles["column--fullWidth"] : "";
    return (
        <div className={`${styles.column} ${classNameFullWidth} ${className}`}>
            {children}
        </div>
    );
}
