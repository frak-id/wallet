import { useEffect } from "react";
import {
    selectDistantWebauthnSession,
    selectWebauthnSession,
    sessionStore,
} from "../../stores/sessionStore";
import {
    getOriginPairingClient,
    getTargetPairingClient,
} from "../clients/store";

/**
 * Reconnect the appropriate pairing client based on the current session type.
 */
function reconnectPairingClient(
    webauthnAddress: string | undefined,
    distantWebauthnAddress: string | undefined
) {
    if (webauthnAddress) {
        getTargetPairingClient().reconnect();
    } else if (distantWebauthnAddress) {
        getOriginPairingClient().reconnect();
    }
}

/**
 * Craft some persistent pairing client (auto reconnects etc).
 *
 * Handles two reconnection triggers:
 * 1. Session changes — reconnect when user authenticates
 * 2. App foreground — reconnect when the app resumes from background,
 *    since mobile OSes kill WebSocket connections while backgrounded
 *    without firing a close event (zombie connections).
 */
export function usePersistentPairingClient() {
    const webauthnSession = sessionStore(selectWebauthnSession);
    const distantWebauthnSession = sessionStore(selectDistantWebauthnSession);

    const webauthnAddress = webauthnSession?.address;
    const distantWebauthnAddress = distantWebauthnSession?.address;

    // Reconnect on session change
    useEffect(() => {
        reconnectPairingClient(webauthnAddress, distantWebauthnAddress);
    }, [distantWebauthnAddress, webauthnAddress]);

    // Reconnect on app foreground — handles zombie connections left by
    // mobile OS killing the socket while backgrounded.
    useEffect(() => {
        // Skip if no session to reconnect with
        if (!webauthnAddress && !distantWebauthnAddress) return;

        let resumeTimer: ReturnType<typeof setTimeout> | null = null;

        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") return;

            // Brief delay to let the network stack stabilize after foregrounding
            resumeTimer = setTimeout(() => {
                reconnectPairingClient(webauthnAddress, distantWebauthnAddress);
            }, 300);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
            if (resumeTimer) clearTimeout(resumeTimer);
        };
    }, [webauthnAddress, distantWebauthnAddress]);
}
