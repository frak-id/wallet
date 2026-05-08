import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";

function checkWebauthNSupport() {
    // If on server side, webauthn not supported
    if (typeof window === "undefined") {
        return false;
    }

    // If running in Tauri, we have the plugin available
    if (IS_TAURI) {
        return true;
    }

    // Check if webauthn is supported natively
    return window.PublicKeyCredential !== undefined;
}

export const isWebAuthNSupported = checkWebauthNSupport();
