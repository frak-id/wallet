import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { LogoFrakWithName } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef, useState } from "react";
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
import * as styles from "./index.css";

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
    const hasInitiatedUnlock = useRef(false);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            checkBiometricStatus().then((status) => {
                setAvailable(status.isAvailable);
                setBiometryType(status.biometryType);
                if (!status.isAvailable) {
                    setEnabled(false);
                }
            });
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [setEnabled, setAvailable, setBiometryType]);

    const handleUnlock = useCallback(async () => {
        if (hasInitiatedUnlock.current) return;

        hasInitiatedUnlock.current = true;
        setIsAuthenticating(true);
        setError(null);

        const result = await authenticateWithBiometrics({
            reason: t("biometrics.unlockReason"),
        });

        setIsAuthenticating(false);
        hasInitiatedUnlock.current = false;

        if (result.success) {
            unlock();
        } else if (result.error && result.error !== "user_cancel") {
            setError(result.error);
        }
    }, [unlock, t]);

    useEffect(() => {
        if (isLocked && !hasInitiatedUnlock.current) {
            handleUnlock();
        }
    }, [isLocked, handleUnlock]);

    if (!isLocked) {
        return null;
    }

    return (
        <Box
            padding="l"
            gap="xl"
            className={styles.lockScreen}
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
        >
            <LogoFrakWithName className={styles.lockScreenLogo} />
            <Box flexDirection="column" alignItems="center" gap="m">
                <Text variant="heading1">{t("biometrics.locked")}</Text>
                <Text variant="bodySmall">
                    {t("biometrics.unlockWith", { type: biometryLabel })}
                </Text>
                {error && (
                    <Text variant="bodySmall">{t("biometrics.error")}</Text>
                )}
            </Box>
            <Button onClick={handleUnlock} disabled={isAuthenticating}>
                {t("biometrics.unlock")}
            </Button>
        </Box>
    );
}
