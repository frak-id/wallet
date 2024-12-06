import styles from "./index.module.css";

export function MainLayout({ children }: { children: React.ReactNode }) {
    return <main className={styles.main}>{children}</main>;
}
