function checkWebauthNSupport() {
    // If on server side, webauthn not supported
    if (typeof window === "undefined") {
        return false;
    }

    // Check if webauthn is supported
    return window.PublicKeyCredential !== undefined;
}

export const isWebAuthNSupported = checkWebauthNSupport();
