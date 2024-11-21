import { useMemo } from "react";

/**
 * Small hook checking if webauthn is supported or not
 */
export function useIsWebAuthNSupported() {
    return useMemo(() => {
        // If on server side, webauthn not supported
        if (typeof window === "undefined") {
            return false;
        }

        // Check if webauthn is supported
        return window.PublicKeyCredential !== undefined;
    }, []);
}
