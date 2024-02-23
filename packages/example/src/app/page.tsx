import { ArticlesList } from "@/module/article/component/ArticlesList";
import styles from "./page.module.css";

export default function HomePage() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Frak news</h1>
            </header>
            <main>
                <p className={styles.introduction}>
                    Demo news paper website showcasing possible integration
                    within the Frak ecosystem
                </p>

                <ArticlesList />
            </main>
            <footer className={styles.footer}>
                2024 -{" "}
                <a href={"https://frak.id"} target={"_blank"} rel="noreferrer">
                    Frak-labs
                </a>
            </footer>
        </div>
    );
}
