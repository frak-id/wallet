import { useEffect, useState } from "react";

function getInitialOnline(): boolean {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
}

/**
 * Tracks the browser's online/offline status via window `online`/`offline`
 * events. Returns `true` when online, `false` when offline.
 */
export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState<boolean>(getInitialOnline);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return isOnline;
}
