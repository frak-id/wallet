import styles from "@/app/layout.module.css";
import { LoadTheme } from "@/module/settings/component/LoadTheme";
import { ClientOnly } from "@module/component/ClientOnly";
import type { ReactNode } from "react";

export function GlobalLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <>
            <div className={"desktop scrollbars"}>
                <main className={styles.main}>
                    <div className={styles.inner}>
                        <ClientOnly>{children}</ClientOnly>
                    </div>
                </main>
            </div>
            <LoadTheme />
        </>
    );
}
