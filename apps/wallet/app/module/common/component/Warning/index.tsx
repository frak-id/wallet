import { cx } from "class-variance-authority";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function Warning({
    text,
    className,
    children,
}: PropsWithChildren<{ text: string; className?: string }>) {
    return (
        <div className={cx(styles.warning, className)}>
            <p>
                <span className={styles.warning__text}>&#9888;</span> {text}
            </p>
            {children}
        </div>
    );
}
