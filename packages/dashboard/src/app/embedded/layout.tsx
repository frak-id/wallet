import type { ReactNode } from "react";
import styles from "./layout.module.css";
import "./layout.css";

export default function EmbeddedLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return <main className={styles.main}>{children}</main>;
}
