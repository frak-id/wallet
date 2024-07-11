import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function ProductItem({ children, ...props }: PropsWithChildren) {
    return (
        <span className={styles.productItem} {...props}>
            {children}
        </span>
    );
}
