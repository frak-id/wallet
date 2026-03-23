import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function SlideThree() {
    const { t } = useTranslation();

    return (
        <div className={styles.slide}>
            <h2 className={styles.slide__title}>
                {t("onboarding.slides.three.title")}
            </h2>
            <p className={styles.slide__description}>
                {t("onboarding.slides.three.description")}
            </p>
        </div>
    );
}
