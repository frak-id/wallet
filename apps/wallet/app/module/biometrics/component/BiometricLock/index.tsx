import { Button } from "@frak-labs/ui/component/Button";
import { LogoFrakWithName } from "@frak-labs/ui/icons/LogoFrakWithName";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBiometricAutoLock } from "@/module/biometrics/hooks/useBiometricAutoLock";
import { useBiometryLabel } from "@/module/biometrics/hooks/useBiometryLabel";
import {
    biometricsStore,
    selectIsLocked,
} from "@/module/biometrics/stores/biometricsStore";
import {
    authenticateWithBiometrics,
    checkBiometricStatus,
} from "@/module/biometrics/utils/biometrics";
import styles from "./index.module.css";

export function BiometricLock() {
    const { t } = useTranslation();
    const isLocked = biometricsStore(selectIsLocked);
    const unlock = biometricsStore((s) => s.unlock);
    const setEnabled = biometricsStore((s) => s.setEnabled);
    const setAvailable = biometricsStore((s) => s.setAvailable);
    const setBiometryType = biometricsStore((s) => s.setBiometryType);

    useBiometricAutoLock();

    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const biometryLabel = useBiometryLabel();

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            checkBiometricStatus().then((status) => {
                setAvailable(status.isAvailable);
                setBiometryType(status.biometryType);
                if (!status.isAvailable) {
                    setEnabled(false);
                    unlock();
                }
            });
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [setEnabled, setAvailable, setBiometryType, unlock]);

    const handleUnlock = useCallback(async () => {
        setIsAuthenticating(true);
        setError(null);

        const result = await authenticateWithBiometrics({
            reason: t("biometrics.unlockReason"),
        });

        setIsAuthenticating(false);

        if (result.success) {
            unlock();
        } else if (result.error && result.error !== "user_cancel") {
            setError(result.error);
        }
    }, [unlock, t]);

    useEffect(() => {
        if (isLocked) {
            handleUnlock();
        }
    }, [isLocked, handleUnlock]);

    if (!isLocked) {
        return null;
    }

    return (
        <div className={styles.lockScreen}>
            <LogoFrakWithName className={styles.lockScreen__logo} />
            <div className={styles.lockScreen__content}>
                <h2 className={styles.lockScreen__title}>
                    {t("biometrics.locked")}
                </h2>
                <p className={styles.lockScreen__subtitle}>
                    {t("biometrics.unlockWith", { type: biometryLabel })}
                </p>
                {error && (
                    <p className={styles.lockScreen__error}>
                        {t("biometrics.error")}
                    </p>
                )}
            </div>
            <Button
                className={styles.lockScreen__button}
                onClick={handleUnlock}
                disabled={isAuthenticating}
                isLoading={isAuthenticating}
            >
                {t("biometrics.unlock")}
            </Button>
        </div>
    );
}
