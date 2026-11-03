import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    authenticateWithBiometrics,
    checkBiometricStatus,
    getBiometryTypeLabel,
    toBiometryType,
} from "./biometrics";

const isTauriMock = vi.hoisted(() => vi.fn(() => false));
vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return isTauriMock();
    },
    IS_ANDROID: false,
    isStandalonePwa: () => false,
}));

describe("biometrics utils", () => {
    it.each([
        ["faceId", "Face ID"],
        ["face", "Face unlock"],
        ["touchId", "Touch ID"],
        ["fingerprint", "Fingerprint"],
        ["iris", "Iris"],
        [null, "Biometrics"],
    ] as const)("getBiometryTypeLabel(%s) is %s", (biometryType, label) => {
        expect(getBiometryTypeLabel(biometryType)).toBe(label);
    });

    it.each([
        [0, false, null],
        [1, false, "touchId"],
        [1, true, "fingerprint"],
        [2, false, "faceId"],
        [2, true, "face"],
        [3, true, "iris"],
    ] as const)(
        "toBiometryType(%s, android: %s) is %s",
        (type, isAndroid, expected) => {
            expect(toBiometryType(type, isAndroid)).toBe(expected);
        }
    );

    describe("outside Tauri", () => {
        beforeEach(() => {
            vi.resetModules();
        });

        it("checkBiometricStatus returns a not_tauri error", async () => {
            expect(await checkBiometricStatus()).toEqual({
                isAvailable: false,
                biometryType: null,
                error: "not_tauri",
            });
        });

        it("authenticateWithBiometrics returns a not_tauri error", async () => {
            expect(await authenticateWithBiometrics()).toEqual({
                success: false,
                error: "not_tauri",
            });
            expect(
                await authenticateWithBiometrics({
                    reason: "Custom reason",
                    cancelTitle: "Cancel",
                })
            ).toEqual({
                success: false,
                error: "not_tauri",
            });
        });
    });
});
