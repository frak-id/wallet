import { useIsWebAuthNSupported } from "@/module/common/hook/useIsWebAuthNSupported";
import type { PropsWithChildren } from "react";

/**
 * Component to require webauthn for the children sub-components
 * @param children
 * @constructor
 */
export function RequireWebAuthN({ children }: PropsWithChildren) {
    // Check if webauthn is supported
    const isWebAuthnSupported = useIsWebAuthNSupported();

    // If webauthn is supported, directly return the children
    if (isWebAuthnSupported) {
        return children;
    }

    // Otherwise, simple message telling that webauthn isn't supported
    return (
        <p>
            Open this page on your default web browser to enjoy Frak rewards and
            benefits.
        </p>
    );
}
