import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "../index.css";
import welcomeLogos from "../welcome_logos.webp";
import { CheckItem } from "./CheckItem";

type IntroSlideProps = {
    items: string[];
    title: string;
};

export function IntroSlide({ items, title }: IntroSlideProps) {
    return (
        <Box className={styles.layoutRow}>
            <Box className={styles.contentArea}>
                <Box className={styles.slideText}>
                    <Text variant="body" weight="semiBold">
                        {title}
                    </Text>
                    {items.map((item) => (
                        <CheckItem key={item} text={item} />
                    ))}
                </Box>
            </Box>
            <Box className={styles.logosSection}>
                <img src={welcomeLogos} alt="" className={styles.logosImage} />
            </Box>
        </Box>
    );
}
