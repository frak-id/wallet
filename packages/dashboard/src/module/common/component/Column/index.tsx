import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type ColumnProps = {
    className?: string;
};

export function Column({
    className = "",
    children,
}: PropsWithChildren<ColumnProps>) {
    return <div className={`${styles.column} ${className}`}>{children}</div>;
}
