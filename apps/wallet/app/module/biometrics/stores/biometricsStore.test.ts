import { beforeEach, describe, expect, it } from "vitest";
import {
    biometricsStore,
    getLockTimeoutMs,
    selectBiometricsEnabled,
    selectBiometricsLockTimeout,
    selectBiometryType,
    selectIsAvailable,
    selectIsLocked,
    selectLastActiveTimestamp,
} from "./biometricsStore";

describe("biometricsStore", () => {
    beforeEach(() => {
        biometricsStore.setState({
            enabled: false,
            lockTimeout: "immediate",
            isLocked: false,
            lastActiveTimestamp: null,
            isAvailable: null,
            biometryType: null,
        });
    });

    describe("getLockTimeoutMs", () => {
        it("should return 0 for immediate", () => {
            expect(getLockTimeoutMs("immediate")).toBe(0);
        });

        it("should return 60000 for 1min", () => {
            expect(getLockTimeoutMs("1min")).toBe(60 * 1000);
        });

        it("should return 300000 for 5min", () => {
            expect(getLockTimeoutMs("5min")).toBe(5 * 60 * 1000);
        });

        it("should return 900000 for 15min", () => {
            expect(getLockTimeoutMs("15min")).toBe(15 * 60 * 1000);
        });
    });

    describe("actions", () => {
        describe("setEnabled", () => {
            it("should enable biometrics and set lastActiveTimestamp", () => {
                const before = Date.now();
                biometricsStore.getState().setEnabled(true);
                const after = Date.now();

                const state = biometricsStore.getState();
                expect(state.enabled).toBe(true);
                expect(state.isLocked).toBe(false);
                expect(state.lastActiveTimestamp).toBeGreaterThanOrEqual(
                    before
                );
                expect(state.lastActiveTimestamp).toBeLessThanOrEqual(after);
            });

            it("should disable biometrics and clear lastActiveTimestamp", () => {
                biometricsStore.getState().setEnabled(true);
                biometricsStore.getState().setEnabled(false);

                const state = biometricsStore.getState();
                expect(state.enabled).toBe(false);
                expect(state.lastActiveTimestamp).toBeNull();
            });
        });

        describe("setLockTimeout", () => {
            it("should update lock timeout", () => {
                biometricsStore.getState().setLockTimeout("5min");
                expect(biometricsStore.getState().lockTimeout).toBe("5min");
            });
        });

        describe("lock", () => {
            it("should set isLocked to true", () => {
                biometricsStore.getState().lock();
                expect(biometricsStore.getState().isLocked).toBe(true);
            });
        });

        describe("unlock", () => {
            it("should set isLocked to false and update lastActiveTimestamp", () => {
                biometricsStore.getState().lock();
                const before = Date.now();
                biometricsStore.getState().unlock();
                const after = Date.now();

                const state = biometricsStore.getState();
                expect(state.isLocked).toBe(false);
                expect(state.lastActiveTimestamp).toBeGreaterThanOrEqual(
                    before
                );
                expect(state.lastActiveTimestamp).toBeLessThanOrEqual(after);
            });
        });

        describe("updateLastActive", () => {
            it("should update lastActiveTimestamp", () => {
                const before = Date.now();
                biometricsStore.getState().updateLastActive();
                const after = Date.now();

                const timestamp =
                    biometricsStore.getState().lastActiveTimestamp;
                expect(timestamp).toBeGreaterThanOrEqual(before);
                expect(timestamp).toBeLessThanOrEqual(after);
            });
        });

        describe("setAvailable", () => {
            it("should update isAvailable", () => {
                biometricsStore.getState().setAvailable(true);
                expect(biometricsStore.getState().isAvailable).toBe(true);

                biometricsStore.getState().setAvailable(false);
                expect(biometricsStore.getState().isAvailable).toBe(false);
            });
        });

        describe("setBiometryType", () => {
            it("should update biometryType", () => {
                biometricsStore.getState().setBiometryType("faceId");
                expect(biometricsStore.getState().biometryType).toBe("faceId");

                biometricsStore.getState().setBiometryType("fingerprint");
                expect(biometricsStore.getState().biometryType).toBe(
                    "fingerprint"
                );
            });
        });
    });

    describe("selectors", () => {
        it("selectBiometricsEnabled should return enabled state", () => {
            const state = biometricsStore.getState();
            expect(selectBiometricsEnabled(state)).toBe(false);

            biometricsStore.getState().setEnabled(true);
            expect(selectBiometricsEnabled(biometricsStore.getState())).toBe(
                true
            );
        });

        it("selectBiometricsLockTimeout should return lockTimeout state", () => {
            const state = biometricsStore.getState();
            expect(selectBiometricsLockTimeout(state)).toBe("immediate");

            biometricsStore.getState().setLockTimeout("15min");
            expect(
                selectBiometricsLockTimeout(biometricsStore.getState())
            ).toBe("15min");
        });

        it("selectIsLocked should return isLocked state", () => {
            expect(selectIsLocked(biometricsStore.getState())).toBe(false);

            biometricsStore.getState().lock();
            expect(selectIsLocked(biometricsStore.getState())).toBe(true);
        });

        it("selectLastActiveTimestamp should return lastActiveTimestamp state", () => {
            expect(selectLastActiveTimestamp(biometricsStore.getState())).toBe(
                null
            );

            biometricsStore.getState().updateLastActive();
            expect(
                selectLastActiveTimestamp(biometricsStore.getState())
            ).not.toBeNull();
        });

        it("selectIsAvailable should return isAvailable state", () => {
            expect(selectIsAvailable(biometricsStore.getState())).toBe(null);

            biometricsStore.getState().setAvailable(true);
            expect(selectIsAvailable(biometricsStore.getState())).toBe(true);
        });

        it("selectBiometryType should return biometryType state", () => {
            expect(selectBiometryType(biometricsStore.getState())).toBe(null);

            biometricsStore.getState().setBiometryType("touchId");
            expect(selectBiometryType(biometricsStore.getState())).toBe(
                "touchId"
            );
        });
    });
});
