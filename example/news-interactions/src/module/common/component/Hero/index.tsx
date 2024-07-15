import Image from "next/image";
import picture from "./assets/picture.jpg";
import styles from "./index.module.css";

export function Hero() {
    return (
        <div className={styles.hero}>
            <Image
                src={picture}
                alt="News Interactions"
                className={styles.hero__image}
            />
            <p className={styles.hero__title}>
                This Is What A Strong Work Ethic Looks Like In 2024
            </p>
        </div>
    );
}
