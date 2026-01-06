import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/ui/component/Select";
import { Switch } from "@frak-labs/ui/component/Switch";
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
import styles from "./index.module.css";

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
            <div className={styles.biometricSettings}>
                <div className={styles.biometricSettings__row}>
                    <span className={styles.biometricSettings__label}>
                        {t("biometrics.settings.enable")}
                    </span>
                    <Switch checked={enabled} onCheckedChange={handleToggle} />
                </div>
                {enabled && (
                    <div className={styles.biometricSettings__row}>
                        <span className={styles.biometricSettings__label}>
                            {t("biometrics.settings.timeout")}
                        </span>
                        <Select
                            value={lockTimeout}
                            onValueChange={handleTimeoutChange}
                        >
                            <SelectTrigger
                                className={styles.biometricSettings__select}
                            >
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
                    </div>
                )}
            </div>
        </Panel>
    );
}
