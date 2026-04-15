import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { Trans } from "react-i18next";
import * as styles from "../index.css";
import notificationBell from "../notification_bell.webp";
import notificationIcon from "../notification_icon.svg";

type NotificationSlideProps = {
    actionI18nKey: string;
    title: string;
};

export function NotificationSlide({
    actionI18nKey,
    title,
}: NotificationSlideProps) {
    return (
        <Box className={styles.layoutRow}>
            <Box className={styles.contentArea}>
                <Box className={styles.slideText}>
                    <Text variant="body" weight="semiBold">
                        {title}
                    </Text>
                    <Box display="flex" alignItems="flex-start" gap="xxs">
                        <img
                            src={notificationIcon}
                            alt=""
                            className={styles.featureIcon}
                        />
                        <Text
                            variant="caption"
                            color="secondary"
                            className={styles.slideDescription}
                        >
                            <Trans i18nKey={actionI18nKey} />
                        </Text>
                    </Box>
                </Box>
            </Box>
            <Box className={styles.logosSection}>
                <img
                    src={notificationBell}
                    alt=""
                    className={styles.logosImage}
                />
            </Box>
        </Box>
    );
}
