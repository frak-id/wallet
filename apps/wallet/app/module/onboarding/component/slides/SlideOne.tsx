import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function SlideOne() {
    const { t } = useTranslation();

    return (
        <div className={styles.slide}>
            <h2 className={styles.slide__title}>
                {t("onboarding.slides.one.title")}
            </h2>
            <p className={styles.slide__description}>
                {t("onboarding.slides.one.description")}
            </p>
        </div>
    );
}
