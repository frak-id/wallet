import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { ChevronRightIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { type KeyboardEvent, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentEmail } from "@/module/authentication/hook/useCurrentEmail";
import * as styles from "./index.css";

/**
 * Wallet-home prompt to add an email when the current credential has none.
 *
 * Renders nothing while the status query is loading, while it errors, or
 * once an email is on file — keeps the surface noise-free for users who
 * already completed the step (or whose session can't carry email, e.g.
 * ECDSA, where the backend returns `null` without writing the row).
 */
export function AddEmailCard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data: emailStatus, isLoading } = useCurrentEmail();

    const handleOpen = useCallback(() => {
        navigate({ to: "/profile/add-email" });
    }, [navigate]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpen();
            }
        },
        [handleOpen]
    );

    if (isLoading || !emailStatus || emailStatus.email !== null) {
        return null;
    }

    return (
        <Card
            variant="secondary"
            padding="none"
            className={styles.card}
            role="button"
            tabIndex={0}
            onClick={handleOpen}
            onKeyDown={handleKeyDown}
        >
            <Box className={styles.layoutRow}>
                <Box className={styles.iconBubble}>
                    <Mail size={20} />
                </Box>
                <Box className={styles.textBlock}>
                    <Text variant="body" weight="semiBold">
                        {t("wallet.addEmail.card.title")}
                    </Text>
                    <Text variant="caption" color="secondary">
                        {t("wallet.addEmail.card.description")}
                    </Text>
                </Box>
                <Box className={styles.chevron}>
                    <ChevronRightIcon width={16} height={16} />
                </Box>
            </Box>
        </Card>
    );
}
