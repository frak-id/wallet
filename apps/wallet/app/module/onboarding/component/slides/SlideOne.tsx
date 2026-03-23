import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";
import slideOneImg from "./slideOne.jpg";

export function SlideOne() {
    const { t } = useTranslation();

    return (
        <div className={styles.slide}>
            <Box className={styles.slideImage}>
                <img src={slideOneImg} alt="" className={styles.slideImg} />
            </Box>
            <Text as="h1" className={styles.slideTitle}>
                {t("onboarding.slides.one.title")}
            </Text>
            <Text as="p" className={styles.slideDescription}>
                {t("onboarding.slides.one.description")}
            </Text>
        </div>
    );
}
