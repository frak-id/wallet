import Image from "next/image";
import Link from "next/link";
import logoArticle from "./assets/logo-article.png";
import logo from "./assets/logo.png";
import styles from "./index.module.css";

export function Header({ inArticle = false }: { inArticle?: boolean }) {
    return (
        <header className={styles.header}>
            <h1 className={styles.header__title}>
                <Link href={"/"} className={styles.header__link}>
                    <Image
                        src={inArticle ? logoArticle : logo}
                        alt="A positive world"
                    />
                </Link>
            </h1>
        </header>
    );
}
