import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function Warning({
    text,
    children,
}: PropsWithChildren<{ text: string }>) {
    return (
        <div className={styles.warning}>
            <p>
                <span className={styles.warning__text}>&#9888;</span> {text}
            </p>
            {children}
        </div>
    );
}
