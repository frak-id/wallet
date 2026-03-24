import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

export type SlideProps = {
    /** Translation key suffix: "one" | "two" | "three" */
    translationKey: string;
    /** Image source */
    image: string;
    /** Image layout variant */
    imageVariant?: "cover" | "center";
};

export function Slide({
    translationKey,
    image,
    imageVariant = "center",
}: SlideProps) {
    const { t } = useTranslation();
    const isCover = imageVariant === "cover";

    return (
        <>
            <Box
                className={
                    isCover ? styles.slideImage : styles.slideImageCenter
                }
            >
                <img
                    src={image}
                    alt=""
                    className={isCover ? styles.slideImg : undefined}
                />
            </Box>
            <Box className={styles.slideContent}>
                <Text variant="heading1" as="h2" className={styles.slideTitle}>
                    {t(`onboarding.slides.${translationKey}.title`)}
                </Text>
                <Text as="p" className={styles.slideDescription}>
                    {t(`onboarding.slides.${translationKey}.description`)}
                </Text>
            </Box>
        </>
    );
}
