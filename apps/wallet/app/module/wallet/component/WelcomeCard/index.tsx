import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import * as styles from "./index.css";
import welcomeLogos from "./welcome_logos.webp";

const STORAGE_KEY = "frak_welcome_dismissed";

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

export function WelcomeCard() {
    const { t } = useTranslation();
    const [isDismissed, setIsDismissed] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === "true";
        } catch {
            return false;
        }
    });

    const handleDismiss = () => {
        setIsDismissed(true);
        try {
            localStorage.setItem(STORAGE_KEY, "true");
        } catch {}
    };

    if (isDismissed) {
        return null;
    }

    return (
        <Card
            variant="secondary"
            padding="none"
            className={styles.cardContainer}
        >
            <Box className={styles.layoutRow}>
                <Box className={styles.contentArea}>
                    <Text variant="body" weight="semiBold">
                        {t("wallet.welcome.title")}
                    </Text>
                    <CheckItem text={t("wallet.welcome.check1")} />
                    <CheckItem text={t("wallet.welcome.check2")} />
                    <CheckItem text={t("wallet.welcome.check3")} />
                </Box>
                <Box className={styles.logosSection}>
                    <CloseButton
                        onClick={handleDismiss}
                        ariaLabel={t("common.close")}
                    />
                    <img
                        src={welcomeLogos}
                        alt=""
                        className={styles.logosImage}
                    />
                </Box>
            </Box>
        </Card>
    );
}
