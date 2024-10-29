import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type PropsNotice = {
    className?: string;
};

export function Notice({
    children,
    className = "",
}: PropsWithChildren<PropsNotice>) {
    return <span className={`${styles.notice} ${className}`}>{children}</span>;
}
