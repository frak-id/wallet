import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function SlideTwo() {
    const { t } = useTranslation();

    return (
        <div className={styles.slide}>
            <h2 className={styles.slide__title}>
                {t("onboarding.slides.two.title")}
            </h2>
            <p className={styles.slide__description}>
                {t("onboarding.slides.two.description")}
            </p>
        </div>
    );
}
