import { useEffect, useState } from "react";
import {
    checkBiometricStatus,
    getBiometryTypeLabel,
} from "@/module/biometrics/utils/biometrics";

export function useBiometryLabel() {
    const [biometryLabel, setBiometryLabel] = useState("Biometrics");

    useEffect(() => {
        checkBiometricStatus().then((status) => {
            if (status.biometryType) {
                setBiometryLabel(getBiometryTypeLabel(status.biometryType));
            }
        });
    }, []);

    return biometryLabel;
}
