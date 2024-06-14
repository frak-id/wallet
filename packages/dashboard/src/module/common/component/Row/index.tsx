import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type RowProps = {
    className?: string;
};

export function Row({ className = "", children }: PropsWithChildren<RowProps>) {
    return <div className={`${styles.row} ${className}`}>{children}</div>;
}
