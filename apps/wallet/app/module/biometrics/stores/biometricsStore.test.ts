import { beforeEach, describe, expect, it } from "vitest";
import { biometricsStore, getLockTimeoutMs } from "./biometricsStore";

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
});
