import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type PropsColumns = {
    size?: "full" | "3-4" | "1-4";
    className?: string;
};

export function Columns({
    className = "",
    children,
}: PropsWithChildren<PropsColumns>) {
    return <div className={`${styles.columns} ${className}`}>{children}</div>;
}

export function Column({
    size,
    className = "",
    children,
}: PropsWithChildren<PropsColumns>) {
    const sizeClass = size ? styles[`column--${size}`] : "";
    return (
        <div className={`${styles.column} ${sizeClass} ${className}`}>
            {children}
        </div>
    );
}
