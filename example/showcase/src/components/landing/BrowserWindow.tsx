import type { ReactNode } from "react";
import styles from "./BrowserWindow.module.css";

type BrowserWindowProps = {
    children: ReactNode;
};

export function BrowserWindow({ children }: BrowserWindowProps) {
    return (
        <div className={styles.browserWindow}>
            <div className={styles.browserControls}>
                <span className={styles.browserDot} />
                <span className={styles.browserDot} />
                <span className={styles.browserDot} />
            </div>
            <div className={styles.browserContent}>{children}</div>
        </div>
    );
}
