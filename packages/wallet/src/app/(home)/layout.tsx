import type { ReactNode } from "react";
import styles from "./layout.module.css";

export default function HomeLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <html lang="en" className={"theme-frak"}>
            <body>
                <main className={styles.main}>
                    <div className={styles.inner}>{children}</div>
                </main>
            </body>
        </html>
    );
}
