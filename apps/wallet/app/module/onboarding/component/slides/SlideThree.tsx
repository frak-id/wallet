import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";
import slideThreeImg from "./SlideThree.png";

export function SlideThree() {
    const { t } = useTranslation();

    return (
        <div className={styles.slide}>
            <Box className={styles.slideImageCenter}>
                <img src={slideThreeImg} alt="" />
            </Box>
            <Text as="h2" className={styles.slideTitle}>
                {t("onboarding.slides.three.title")}
            </Text>
            <Text as="p" className={styles.slideDescription}>
                {t("onboarding.slides.three.description")}
            </Text>
        </div>
    );
}
