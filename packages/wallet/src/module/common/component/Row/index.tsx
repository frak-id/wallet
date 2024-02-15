import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export default function Row({
    withIcon,
    children,
}: PropsWithChildren<{ withIcon?: boolean }>) {
    return (
        <p className={`${styles.row} ${withIcon ? styles.row__withIcon : ""}`}>
            {children}
        </p>
    );
}
