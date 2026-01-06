import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BiometricLockTimeout = "immediate" | "1min" | "5min" | "15min";

export type BiometryType = "faceId" | "touchId" | "fingerprint" | "iris" | null;

type BiometricsState = {
    enabled: boolean;
    lockTimeout: BiometricLockTimeout;
    isLocked: boolean;
    lastActiveTimestamp: number | null;
    isAvailable: boolean | null;
    biometryType: BiometryType;
};

type BiometricsActions = {
    setEnabled: (enabled: boolean) => void;
    setLockTimeout: (timeout: BiometricLockTimeout) => void;
    lock: () => void;
    unlock: () => void;
    updateLastActive: () => void;
    setAvailable: (available: boolean) => void;
    setBiometryType: (type: BiometryType) => void;
};

const initialState: BiometricsState = {
    enabled: false,
    lockTimeout: "immediate",
    isLocked: false,
    lastActiveTimestamp: null,
    isAvailable: null,
    biometryType: null,
};

export const biometricsStore = create<BiometricsState & BiometricsActions>()(
    persist(
        (set) => ({
            ...initialState,

            setEnabled: (enabled) =>
                set({
                    enabled,
                    isLocked: false,
                    lastActiveTimestamp: enabled ? Date.now() : null,
                }),

            setLockTimeout: (lockTimeout) => set({ lockTimeout }),

            lock: () => set({ isLocked: true }),

            unlock: () =>
                set({ isLocked: false, lastActiveTimestamp: Date.now() }),

            updateLastActive: () => set({ lastActiveTimestamp: Date.now() }),

            setAvailable: (available) => set({ isAvailable: available }),

            setBiometryType: (biometryType) => set({ biometryType }),
        }),
        {
            name: "frak_biometrics_store",
            partialize: (state) => ({
                enabled: state.enabled,
                lockTimeout: state.lockTimeout,
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.enabled) {
                    state.lock();
                }
            },
        }
    )
);

export const selectBiometricsEnabled = (
    state: BiometricsState & BiometricsActions
) => state.enabled;

export const selectBiometricsLockTimeout = (
    state: BiometricsState & BiometricsActions
) => state.lockTimeout;

export const selectIsLocked = (state: BiometricsState & BiometricsActions) =>
    state.isLocked;

export const selectLastActiveTimestamp = (
    state: BiometricsState & BiometricsActions
) => state.lastActiveTimestamp;

export const selectIsAvailable = (state: BiometricsState & BiometricsActions) =>
    state.isAvailable;

export const selectBiometryType = (
    state: BiometricsState & BiometricsActions
) => state.biometryType;

export function getLockTimeoutMs(timeout: BiometricLockTimeout): number {
    switch (timeout) {
        case "immediate":
            return 0;
        case "1min":
            return 60 * 1000;
        case "5min":
            return 5 * 60 * 1000;
        case "15min":
            return 15 * 60 * 1000;
    }
}
