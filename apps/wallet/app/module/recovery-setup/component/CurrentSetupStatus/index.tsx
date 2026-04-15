import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import * as styles from "./index.css";

/**
 * Component for the settings with the recovery options
 * @constructor
 */
export function CurrentRecoverySetupStatus() {
    const { t } = useTranslation();
    const { recoverySetupStatus } = useRecoverySetupStatus();

    if (!recoverySetupStatus) {
        return null;
    }

    return (
        <Card>
            <Stack space="xs">
                <Stack space="xxs">
                    <Text variant="label">
                        {t("wallet.recoverySetup.currentGuardian")}
                    </Text>
                    <Text as="span" className={styles.addressValue}>
                        {recoverySetupStatus.guardianAddress}
                    </Text>
                </Stack>
                <Badge variant="success">
                    {t("wallet.recoverySetup.active", "Active")}
                </Badge>
            </Stack>
        </Card>
    );
}
