import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "../index.css";
import welcomeLogos from "../welcome_logos.webp";

type FrakBonusSlideProps = {
    title: string;
    description: string;
    cta: string;
};

export function FrakBonusSlide({
    title,
    description,
    cta,
}: FrakBonusSlideProps) {
    return (
        <Box className={styles.layoutRow}>
            <Box className={styles.contentArea}>
                <Box className={styles.slideText}>
                    <Text variant="body" weight="semiBold">
                        {title}
                    </Text>
                    <Text
                        variant="caption"
                        color="secondary"
                        className={styles.slideDescription}
                    >
                        {description}
                    </Text>
                    <Text variant="caption" color="action" weight="medium">
                        {cta}
                    </Text>
                </Box>
            </Box>
            <Box className={styles.logosSection}>
                <img src={welcomeLogos} alt="" className={styles.logosImage} />
            </Box>
        </Box>
    );
}
