import {
    biometricsStore,
    selectBiometryType,
} from "@/module/biometrics/stores/biometricsStore";
import { getBiometryTypeLabel } from "@/module/biometrics/utils/biometrics";

export function useBiometryLabel() {
    const biometryType = biometricsStore(selectBiometryType);
    return getBiometryTypeLabel(biometryType);
}
