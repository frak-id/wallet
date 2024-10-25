import { Footer } from "@/module/common/component/Footer";
import { Header } from "@/module/common/component/Header";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export function MainLayout({ children }: { children: ReactNode }) {
    return (
        <div className={"desktop scrollbars"}>
            <main className={styles.main}>
                <div className={styles.inner}>
                    <Header />
                    {children}
                    <Footer />
                </div>
            </main>
        </div>
    );
}
