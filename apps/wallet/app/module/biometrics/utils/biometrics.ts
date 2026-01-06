import { isTauri } from "@frak-labs/app-essentials/utils/platform";

type BiometricStatus = {
    isAvailable: boolean;
    biometryType: "faceId" | "touchId" | "fingerprint" | "iris" | null;
    error: string | null;
};

type AuthenticateOptions = {
    reason?: string;
    cancelTitle?: string;
    allowDeviceCredential?: boolean;
    fallbackTitle?: string;
};

let biometricModule: typeof import("@tauri-apps/plugin-biometric") | null =
    null;

async function getBiometricModule() {
    if (!isTauri()) return null;
    if (biometricModule) return biometricModule;
    try {
        console.log("[Biometrics] Loading biometric module...");
        biometricModule = await import("@tauri-apps/plugin-biometric");
        console.log("[Biometrics] Module loaded successfully");
        return biometricModule;
    } catch (error) {
        console.error("[Biometrics] Failed to load module:", error);
        return null;
    }
}

export async function checkBiometricStatus(): Promise<BiometricStatus> {
    const module = await getBiometricModule();
    if (!module) {
        return { isAvailable: false, biometryType: null, error: "not_tauri" };
    }

    try {
        const status = await module.checkStatus();
        return {
            isAvailable: status.isAvailable,
            biometryType:
                (status.biometryType as unknown as BiometricStatus["biometryType"]) ??
                null,
            error: status.error ?? null,
        };
    } catch (error) {
        return {
            isAvailable: false,
            biometryType: null,
            error: error instanceof Error ? error.message : "unknown_error",
        };
    }
}

export async function authenticateWithBiometrics(
    options: AuthenticateOptions = {}
): Promise<{ success: boolean; error: string | null }> {
    const module = await getBiometricModule();
    if (!module) {
        return { success: false, error: "not_tauri" };
    }

    try {
        await module.authenticate(
            options.reason ?? "Authenticate to access your wallet",
            {
                cancelTitle: options.cancelTitle,
                allowDeviceCredential: options.allowDeviceCredential ?? true,
                fallbackTitle: options.fallbackTitle,
            }
        );
        return { success: true, error: null };
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "authentication_failed",
        };
    }
}

export function getBiometryTypeLabel(
    biometryType: BiometricStatus["biometryType"]
): string {
    switch (biometryType) {
        case "faceId":
            return "Face ID";
        case "touchId":
            return "Touch ID";
        case "fingerprint":
            return "Fingerprint";
        case "iris":
            return "Iris";
        default:
            return "Biometrics";
    }
}
