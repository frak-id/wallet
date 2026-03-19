import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

export function SlideTwo() {
    const { t } = useTranslation();

    return (
        <div className={styles.slide}>
            <Text as="h2" className={styles.slideTitle}>
                {t("onboarding.slides.two.title")}
            </Text>
            <Text as="p" className={styles.slideDescription}>
                {t("onboarding.slides.two.description")}
            </Text>
        </div>
    );
}
