import { useEffect, useState } from "react";

/**
 * True once the document CSP refuses `directive` for a URL containing `host`.
 * OTA bundles also reach native binaries whose baked-in CSP predates the Ramp origins.
 */
export function useCspBlocked(
    directive: "frame-src" | "connect-src",
    host: string,
    onBlocked?: () => void
): boolean {
    const [blocked, setBlocked] = useState(false);
    useEffect(() => {
        const onViolation = (event: SecurityPolicyViolationEvent) => {
            if (
                event.effectiveDirective === directive &&
                event.blockedURI.includes(host)
            ) {
                setBlocked(true);
                onBlocked?.();
            }
        };
        document.addEventListener("securitypolicyviolation", onViolation);
        return () =>
            document.removeEventListener(
                "securitypolicyviolation",
                onViolation
            );
    }, [directive, host, onBlocked]);
    return blocked;
}
