import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    authenticateWithBiometrics,
    checkBiometricStatus,
    getBiometryTypeLabel,
} from "./biometrics";

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isTauri: vi.fn(() => false),
}));

describe("biometrics utils", () => {
    describe("getBiometryTypeLabel", () => {
        it("should return 'Face ID' for faceId", () => {
            expect(getBiometryTypeLabel("faceId")).toBe("Face ID");
        });

        it("should return 'Touch ID' for touchId", () => {
            expect(getBiometryTypeLabel("touchId")).toBe("Touch ID");
        });

        it("should return 'Fingerprint' for fingerprint", () => {
            expect(getBiometryTypeLabel("fingerprint")).toBe("Fingerprint");
        });

        it("should return 'Iris' for iris", () => {
            expect(getBiometryTypeLabel("iris")).toBe("Iris");
        });

        it("should return 'Biometrics' for null", () => {
            expect(getBiometryTypeLabel(null)).toBe("Biometrics");
        });
    });

    describe("checkBiometricStatus", () => {
        beforeEach(() => {
            vi.resetModules();
        });

        it("should return not_tauri error when not in Tauri environment", async () => {
            const result = await checkBiometricStatus();

            expect(result).toEqual({
                isAvailable: false,
                biometryType: null,
                error: "not_tauri",
            });
        });
    });

    describe("authenticateWithBiometrics", () => {
        beforeEach(() => {
            vi.resetModules();
        });

        it("should return not_tauri error when not in Tauri environment", async () => {
            const result = await authenticateWithBiometrics();

            expect(result).toEqual({
                success: false,
                error: "not_tauri",
            });
        });

        it("should return not_tauri error with custom options when not in Tauri", async () => {
            const result = await authenticateWithBiometrics({
                reason: "Custom reason",
                cancelTitle: "Cancel",
            });

            expect(result).toEqual({
                success: false,
                error: "not_tauri",
            });
        });
    });
});
