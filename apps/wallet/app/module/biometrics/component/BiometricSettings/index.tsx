import { Box } from "@frak-labs/design-system/components/Box";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { Fingerprint } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    type BiometricLockTimeout,
    biometricsStore,
    selectBiometricsEnabled,
    selectBiometricsLockTimeout,
    selectIsAvailable,
} from "@/module/biometrics/stores/biometricsStore";
import { authenticateWithBiometrics } from "@/module/biometrics/utils/biometrics";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

export function BiometricSettings() {
    const { t } = useTranslation();
    const enabled = biometricsStore(selectBiometricsEnabled);
    const lockTimeout = biometricsStore(selectBiometricsLockTimeout);
    const isAvailable = biometricsStore(selectIsAvailable);
    const setEnabled = biometricsStore((s) => s.setEnabled);
    const setLockTimeout = biometricsStore((s) => s.setLockTimeout);

    if (!isAvailable) {
        return null;
    }

    const handleToggle = async (checked: boolean) => {
        if (checked) {
            const result = await authenticateWithBiometrics({
                reason: t("biometrics.settings.enable"),
            });
            if (result.success) {
                setEnabled(true);
            }
        } else {
            setEnabled(false);
        }
    };

    const handleTimeoutChange = (value: string) => {
        setLockTimeout(value as BiometricLockTimeout);
    };

    return (
        <Panel size={"small"}>
            <Title icon={<Fingerprint size={32} />}>
                {t("biometrics.settings.title")}
            </Title>
            <Box flexDirection="column" gap="m" padding="none">
                <Box
                    flexDirection="row"
                    padding="none"
                    alignItems="center"
                    justifyContent="space-between"
                    className={styles.settingsRow}
                >
                    <Text variant="bodySmall">
                        {t("biometrics.settings.enable")}
                    </Text>
                    <Switch checked={enabled} onCheckedChange={handleToggle} />
                </Box>
                {enabled && (
                    <Box
                        flexDirection="row"
                        padding="none"
                        alignItems="center"
                        justifyContent="space-between"
                        className={styles.settingsRow}
                    >
                        <Text variant="bodySmall">
                            {t("biometrics.settings.timeout")}
                        </Text>
                        <Select
                            value={lockTimeout}
                            onValueChange={handleTimeoutChange}
                        >
                            <SelectTrigger className={styles.settingsSelect}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="immediate">
                                    {t("biometrics.settings.timeoutImmediate")}
                                </SelectItem>
                                <SelectItem value="1min">
                                    {t("biometrics.settings.timeout1min")}
                                </SelectItem>
                                <SelectItem value="5min">
                                    {t("biometrics.settings.timeout5min")}
                                </SelectItem>
                                <SelectItem value="15min">
                                    {t("biometrics.settings.timeout15min")}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </Box>
                )}
            </Box>
        </Panel>
    );
}
