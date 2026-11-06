import { useEffect } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/** Keeps the presenter's phone awake; the lock drops whenever the tab hides. */
export function useWakeLock() {
    useEffect(() => {
        const { wakeLock } = navigator as WakeLockNavigator;
        if (!wakeLock) return;
        let sentinel: WakeLockSentinelLike | null = null;
        let pending = false;
        let disposed = false;

        const acquire = () => {
            if (document.visibilityState !== "visible") return;
            if (sentinel || pending || disposed) return;
            pending = true;
            wakeLock
                .request("screen")
                .then((lock) => {
                    if (disposed) return lock.release();
                    sentinel = lock;
                })
                .catch(() => {
                    // Refused without a user gesture; the next tap retries.
                })
                .finally(() => {
                    pending = false;
                });
        };
        const onVisibility = () => {
            sentinel = null;
            acquire();
        };

        acquire();
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pointerdown", acquire);
        return () => {
            disposed = true;
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pointerdown", acquire);
            sentinel?.release().catch(() => undefined);
        };
    }, []);
}
