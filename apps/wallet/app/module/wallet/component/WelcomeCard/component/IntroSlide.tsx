import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import * as styles from "../index.css";
import welcomeLogos from "../welcome_logos.webp";

type IntroSlideProps = {
    items: string[];
    title: string;
};

function CheckItem({ text }: { text: string }) {
    return (
        <Box className={styles.checkItem}>
            <Box className={styles.checkItemIcon}>
                <CheckIcon width={12} height={12} color={vars.text.action} />
            </Box>
            <Text variant="caption" color="secondary">
                {text}
            </Text>
        </Box>
    );
}

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
