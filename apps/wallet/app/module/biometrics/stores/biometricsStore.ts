import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BiometricLockTimeout = "immediate" | "1min" | "5min" | "15min";

type BiometricsState = {
    enabled: boolean;
    lockTimeout: BiometricLockTimeout;
    isLocked: boolean;
    lastActiveTimestamp: number | null;
};

type BiometricsActions = {
    setEnabled: (enabled: boolean) => void;
    setLockTimeout: (timeout: BiometricLockTimeout) => void;
    lock: () => void;
    unlock: () => void;
    updateLastActive: () => void;
};

const initialState: BiometricsState = {
    enabled: false,
    lockTimeout: "immediate",
    isLocked: false,
    lastActiveTimestamp: null,
};

export const biometricsStore = create<BiometricsState & BiometricsActions>()(
    persist(
        (set) => ({
            ...initialState,

            setEnabled: (enabled) =>
                set({ enabled, isLocked: enabled, lastActiveTimestamp: null }),

            setLockTimeout: (lockTimeout) => set({ lockTimeout }),

            lock: () => set({ isLocked: true }),

            unlock: () =>
                set({ isLocked: false, lastActiveTimestamp: Date.now() }),

            updateLastActive: () => set({ lastActiveTimestamp: Date.now() }),
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
