import { findIframeInOpener } from "@frak-labs/core-sdk";
import { useEffect, useRef, useState } from "react";
import styles from "./sso-popup.module.css";

export function SsoPopupView() {
    const readySignalSent = useRef(false);
    const listenerIframeRef = useRef<Window | null>(null);
    const isNavigating = useRef(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const messageHandler = (event: MessageEvent) => {
            // Only accept messages from our origin
            if (event.origin !== window.location.origin) {
                return;
            }

            if (event.data?.type === "sso_url" && event.data?.url) {
                // Set navigating flag so beforeunload doesn't send close message
                isNavigating.current = true;
                window.location.replace(event.data.url);
            }
        };

        const beforeUnloadHandler = () => {
            // Only notify if we're actually closing (not navigating to SSO page)
            // Note: beforeunload is not 100% reliable on mobile browsers (iOS Safari, Android Chrome)
            // The handler's 10s timeout will catch these edge cases where the event doesn't fire
            if (!isNavigating.current && listenerIframeRef.current) {
                listenerIframeRef.current.postMessage(
                    { type: "sso_popup_closed" },
                    window.location.origin
                );
            }
        };

        window.addEventListener("message", messageHandler);
        window.addEventListener("beforeunload", beforeUnloadHandler);

        // Find listener iframe
        listenerIframeRef.current = findIframeInOpener();

        // Check if iframe was found
        if (!listenerIframeRef.current) {
            setError(
                "Could not connect to wallet. Please ensure you opened this from the wallet application."
            );
            return;
        }

        // Notify listener iframe that we're ready - delayed to handle React Strict Mode double-render
        const readyTimeout = setTimeout(() => {
            if (!readySignalSent.current && listenerIframeRef.current) {
                readySignalSent.current = true;
                listenerIframeRef.current.postMessage(
                    { type: "sso_popup_ready" },
                    window.location.origin
                );
            }
        }, 50);

        // Set connection timeout - if no redirect happens, show error
        const connectionTimeout = setTimeout(() => {
            if (!isNavigating.current) {
                setError(
                    "Connection timeout. The wallet did not respond in time."
                );
            }
        }, 5000);

        return () => {
            clearTimeout(readyTimeout);
            clearTimeout(connectionTimeout);
            window.removeEventListener("beforeunload", beforeUnloadHandler);
            window.removeEventListener("message", messageHandler);
        };
    }, []);

    if (error) {
        return (
            <div className={styles.container}>
                <p className={styles.error}>{error}</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <p>Redirecting...</p>
        </div>
    );
}

export default SsoPopupView;
