import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "../index.css";
import inviteImage from "../invite_friends.webp";
import { CheckItem } from "./CheckItem";

type InviteSlideProps = {
    items: string[];
    title: string;
};

export function InviteSlide({ items, title }: InviteSlideProps) {
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
                <img src={inviteImage} alt="" className={styles.logosImage} />
            </Box>
        </Box>
    );
}
