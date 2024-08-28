"use client";

import { type PropsWithChildren, useMemo } from "react";

/**
 * Component to require webauthn for the children sub-components
 * @param children
 * @constructor
 */
export function RequireWebAuthN({ children }: PropsWithChildren) {
    // Check if webauthn is supported
    const isWebAuthnSupported = useMemo(() => {
        // If on server side, webauthn not supported
        if (typeof window === "undefined") {
            return false;
        }

        // Check if webauthn is supported
        return window.PublicKeyCredential !== undefined;
    }, []);

    // If webauthn is supported, directly return the children
    if (isWebAuthnSupported) {
        return children;
    }

    // Otherwise, simple message telling that webauthn isn't supported
    return (
        <p>
            Open this page on your default web browser to enjoy Nexus rewards
            and benefits.
        </p>
    );
}
