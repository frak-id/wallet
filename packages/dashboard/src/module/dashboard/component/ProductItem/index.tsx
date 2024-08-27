import type { HTMLAttributes, PropsWithChildren } from "react";
import styles from "./index.module.css";

export function ProductItem({
    children,
    ...props
}: Omit<PropsWithChildren<HTMLAttributes<HTMLSpanElement>>, "className">) {
    return (
        <span className={styles.productItem} {...props}>
            {children}
        </span>
    );
}
