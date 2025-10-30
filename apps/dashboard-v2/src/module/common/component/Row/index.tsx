import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type RowProps = {
    align?: "start" | "center" | "end";
    className?: string;
};

export function Row({
    align = "end",
    className = "",
    children,
}: PropsWithChildren<RowProps>) {
    const alignClass = styles[`row--${align}`];
    return (
        <div className={`${styles.row} ${alignClass} ${className}`}>
            {children}
        </div>
    );
}
