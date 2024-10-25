import styles from "./index.module.css";

export function Footer() {
    return (
        <>
            <ul className={styles.preFooter}>
                <li>Contact Us</li>
                <li>Work With Us</li>
                <li>Advertise</li>
                <li>Privacy</li>
            </ul>
            <footer className={styles.footer}>
                <p>
                    News provided by{" "}
                    <a
                        href={"https://worldnewsapi.com/"}
                        target={"_blank"}
                        rel={"noreferrer"}
                    >
                        WorldNewsApi
                    </a>
                </p>
                <p>
                    <strong>© 2024 A Positive World Company</strong>
                </p>
            </footer>
        </>
    );
}
