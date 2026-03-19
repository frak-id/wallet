import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

export function SlideOne() {
    const { t } = useTranslation();

    return (
        <div className={styles.slide}>
            <Text as="h2" className={styles.slideTitle}>
                {t("onboarding.slides.one.title")}
            </Text>
            <Text as="p" className={styles.slideDescription}>
                {t("onboarding.slides.one.description")}
            </Text>
        </div>
    );
}
