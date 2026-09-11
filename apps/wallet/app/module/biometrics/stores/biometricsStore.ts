import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BiometricLockTimeout = "immediate" | "1min" | "5min" | "15min";

type BiometryType = "faceId" | "touchId" | "fingerprint" | "iris" | null;

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

type BiometricsStore = BiometricsState & BiometricsActions;

const initialState: BiometricsState = {
    enabled: false,
    lockTimeout: "immediate",
    isLocked: false,
    lastActiveTimestamp: null,
    isAvailable: null,
    biometryType: null,
};

export const biometricsStore = create<BiometricsStore>()(
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

export const selectBiometricsEnabled = (state: BiometricsStore) =>
    state.enabled;

export const selectBiometricsLockTimeout = (state: BiometricsStore) =>
    state.lockTimeout;

export const selectIsLocked = (state: BiometricsStore) => state.isLocked;

export const selectLastActiveTimestamp = (state: BiometricsStore) =>
    state.lastActiveTimestamp;

export const selectIsAvailable = (state: BiometricsStore) => state.isAvailable;

export const selectBiometryType = (state: BiometricsStore) =>
    state.biometryType;

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
