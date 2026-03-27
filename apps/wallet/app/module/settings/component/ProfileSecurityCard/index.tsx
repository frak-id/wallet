import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { selectWebauthnSession, sessionStore } from "@frak-labs/wallet-shared";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import * as styles from "./index.css";

export function ProfileSecurityCard() {
    const { t } = useTranslation();
    const webauthnSession = sessionStore(selectWebauthnSession);
    const { recoverySetupStatus } = useRecoverySetupStatus();

    if (!webauthnSession) {
        return null;
    }

    return (
        <Card className={styles.card}>
            <Link
                to="/profile/recovery"
                viewTransition
                className={styles.rowLink}
            >
                <Box className={styles.rowContent}>
                    <Shield size={18} className={styles.icon} />
                    <Box className={styles.textGroup}>
                        <Text as="span" variant="body" weight="medium">
                            {t("wallet.recoverySetup.title")}
                        </Text>
                        <Text as="span" variant="caption" color="secondary">
                            {recoverySetupStatus
                                ? t(
                                      "wallet.profile.recoveryConfigured",
                                      "Configured"
                                  )
                                : t(
                                      "wallet.recoverySetup.setupNew",
                                      "Setup new recovery"
                                  )}
                        </Text>
                    </Box>
                </Box>
                <Box className={styles.row}>
                    {recoverySetupStatus ? (
                        <Badge variant="success">
                            {t("wallet.recoverySetup.active", "Active")}
                        </Badge>
                    ) : null}
                    <ChevronRight size={18} className={styles.chevron} />
                </Box>
            </Link>
        </Card>
    );
}
