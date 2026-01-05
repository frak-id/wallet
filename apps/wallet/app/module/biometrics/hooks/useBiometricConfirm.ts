import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    biometricsStore,
    selectBiometricsEnabled,
} from "@/module/biometrics/stores/biometricsStore";
import {
    authenticateWithBiometrics,
    checkBiometricStatus,
    getBiometryTypeLabel,
} from "@/module/biometrics/utils/biometrics";

type UseBiometricConfirmOptions = {
    reason?: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
    onCancel?: () => void;
};

export function useBiometricConfirm(options: UseBiometricConfirmOptions = {}) {
    const { t } = useTranslation();
    const enabled = biometricsStore(selectBiometricsEnabled);
    const [isConfirming, setIsConfirming] = useState(false);
    const [biometryLabel, setBiometryLabel] = useState("Biometrics");

    useEffect(() => {
        checkBiometricStatus().then((status) => {
            if (status.biometryType) {
                setBiometryLabel(getBiometryTypeLabel(status.biometryType));
            }
        });
    }, []);

    const confirm = useCallback(async (): Promise<boolean> => {
        if (!enabled) {
            return true;
        }

        setIsConfirming(true);

        const result = await authenticateWithBiometrics({
            reason:
                options.reason ??
                t("biometrics.confirmAction", { type: biometryLabel }),
        });

        setIsConfirming(false);

        if (result.success) {
            options.onSuccess?.();
            return true;
        }

        if (result.error === "user_cancel") {
            options.onCancel?.();
        } else if (result.error) {
            options.onError?.(result.error);
        }

        return false;
    }, [enabled, options, biometryLabel, t]);

    return {
        confirm,
        isConfirming,
        isEnabled: enabled,
        biometryLabel,
    };
}
