import type { ReactNode } from "react";
import { Navigation } from "../Navigation";
import styles from "./index.module.css";

export function GlobalLayout({
    navigation = false,
    children,
}: Readonly<{
    navigation?: boolean;
    children: ReactNode;
}>) {
    return (
        <div className={"desktop scrollbars"}>
            <div className={styles.wrapper}>
                <main className={styles.main}>
                    <div className={styles.inner}>{children}</div>
                </main>
            </div>
            {navigation && <Navigation />}
        </div>
    );
}
