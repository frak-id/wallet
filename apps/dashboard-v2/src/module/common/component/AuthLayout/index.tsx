import { type ReactNode, useEffect } from "react";
import styles from "./index.module.css";

export function AuthLayout({ children }: { children: ReactNode }) {
    /**
     * Add a data attribute to the root element to style the layout
     */
    useEffect(() => {
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.dataset.page = "authentication";
        }

        return () => {
            rootElement.removeAttribute("data-page");
        };
    }, []);

    return (
        <div>
            <div className={styles["ellipse-blue-corner"]} />
            <div className={styles["ellipse-blue-top"]} />
            <div className={styles["ellipse-white-1"]} />
            <div className={styles["ellipse-red-1"]} />
            <main className={styles.main}>{children}</main>
        </div>
    );
}
