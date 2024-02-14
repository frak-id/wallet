import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type PanelProps = {
    variant?: "primary" | "secondary" | "outlined";
};

export function Panel({ variant, children }: PropsWithChildren<PanelProps>) {
    const variantClass = variant ? styles[variant] : styles.primary;
    return <div className={`${styles.panel} ${variantClass}`}>{children}</div>;
}
