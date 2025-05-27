import { Header } from "@/module/common/component/Header";
import { Navigation } from "@/module/common/component/Navigation";
import { cx } from "class-variance-authority";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export function GlobalLayout({
    header = true,
    navigation = false,
    children,
}: Readonly<{
    header?: boolean;
    navigation?: boolean;
    children: ReactNode;
}>) {
    return (
        <div className={"desktop scrollbars"}>
            {header && <Header />}
            <main
                className={cx(
                    styles.main,
                    !header && styles.mainNoHeader,
                    !navigation && styles.mainNoNav
                )}
            >
                {children}
            </main>
            {navigation && <Navigation />}
        </div>
    );
}
