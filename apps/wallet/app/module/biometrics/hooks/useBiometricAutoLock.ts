import { useEffect, useRef } from "react";
import {
    biometricsStore,
    getLockTimeoutMs,
    selectBiometricsEnabled,
    selectBiometricsLockTimeout,
    selectLastActiveTimestamp,
} from "@/module/biometrics/stores/biometricsStore";

export function useBiometricAutoLock() {
    const enabled = biometricsStore(selectBiometricsEnabled);
    const lockTimeout = biometricsStore(selectBiometricsLockTimeout);
    const lastActiveTimestamp = biometricsStore(selectLastActiveTimestamp);
    const lock = biometricsStore((s) => s.lock);
    const updateLastActive = biometricsStore((s) => s.updateLastActive);

    const hiddenTimestampRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                hiddenTimestampRef.current = Date.now();
            } else {
                const hiddenAt = hiddenTimestampRef.current;
                hiddenTimestampRef.current = null;

                if (hiddenAt === null) return;

                const timeoutMs = getLockTimeoutMs(lockTimeout);
                const elapsed = Date.now() - hiddenAt;

                if (elapsed >= timeoutMs) {
                    lock();
                } else {
                    updateLastActive();
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [enabled, lockTimeout, lock, updateLastActive]);

    useEffect(() => {
        if (!enabled || !lastActiveTimestamp) return;

        const timeoutMs = getLockTimeoutMs(lockTimeout);
        if (timeoutMs === 0) return;

        const elapsed = Date.now() - lastActiveTimestamp;
        const remaining = timeoutMs - elapsed;

        if (remaining <= 0) {
            lock();
            return;
        }

        const timer = setTimeout(() => {
            if (document.hidden) {
                lock();
            }
        }, remaining);

        return () => clearTimeout(timer);
    }, [enabled, lockTimeout, lastActiveTimestamp, lock]);
}
