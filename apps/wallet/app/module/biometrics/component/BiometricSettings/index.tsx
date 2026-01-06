import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Switch } from "@frak-labs/ui/component/Switch";
import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    type BiometricLockTimeout,
    biometricsStore,
    selectBiometricsEnabled,
    selectBiometricsLockTimeout,
} from "@/module/biometrics/stores/biometricsStore";
import {
    authenticateWithBiometrics,
    checkBiometricStatus,
} from "@/module/biometrics/utils/biometrics";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import styles from "./index.module.css";

export function BiometricSettings() {
    const { t } = useTranslation();
    const enabled = biometricsStore(selectBiometricsEnabled);
    const lockTimeout = biometricsStore(selectBiometricsLockTimeout);
    const setEnabled = biometricsStore((s) => s.setEnabled);
    const setLockTimeout = biometricsStore((s) => s.setLockTimeout);

    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        if (!isTauri()) {
            setIsAvailable(false);
            return;
        }

        checkBiometricStatus()
            .then((status) => {
                setIsAvailable(status.isAvailable);
            })
            .catch(() => {
                setIsAvailable(false);
            });
    }, []);

    if (isAvailable === null) {
        return null;
    }

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

    const handleTimeoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLockTimeout(e.target.value as BiometricLockTimeout);
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
                        <select
                            className={styles.biometricSettings__select}
                            value={lockTimeout}
                            onChange={handleTimeoutChange}
                        >
                            <option value="immediate">
                                {t("biometrics.settings.timeoutImmediate")}
                            </option>
                            <option value="1min">
                                {t("biometrics.settings.timeout1min")}
                            </option>
                            <option value="5min">
                                {t("biometrics.settings.timeout5min")}
                            </option>
                            <option value="15min">
                                {t("biometrics.settings.timeout15min")}
                            </option>
                        </select>
                    </div>
                )}
            </div>
        </Panel>
    );
}
