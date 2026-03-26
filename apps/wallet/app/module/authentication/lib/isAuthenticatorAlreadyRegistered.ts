/**
 * Patterns indicating the authenticator is already registered.
 *
 * - "InvalidStateError": WebAuthn spec DOMException name (iOS/Web)
 * - "excluded credentials exists": Android Credential Manager message
 *   ("One of the excluded credentials exists on the local device.")
 */
const alreadyRegisteredPatterns = [
    "InvalidStateError",
    "INVALID_STATE_ERROR",
    "excluded credentials exists",
] as const;

/**
 * Check if a registration error indicates the authenticator is already registered.
 *
 * WebAuthn spec throws InvalidStateError when excludeCredentials matches,
 * but the error gets wrapped differently per platform:
 *
 * - iOS/Web: CredentialCreationFailedError → DOMException("InvalidStateError")
 * - Android Tauri: CredentialCreationFailedError → BaseError →
 *     Error("One of the excluded credentials exists on the local device.")
 *
 * This walks the full cause chain checking names and messages.
 */
export function isAuthenticatorAlreadyRegistered(error: Error): boolean {
    let current: unknown = error;
    // Walk up to 3 levels: ox wrapper → platform error → normalized error
    for (let i = 0; i < 3 && current; i++) {
        if (
            current instanceof DOMException &&
            current.name === "InvalidStateError"
        ) {
            return true;
        }
        if (current instanceof Error) {
            const msg = current.message;
            if (
                alreadyRegisteredPatterns.some((pattern) =>
                    msg.includes(pattern)
                )
            ) {
                return true;
            }
        }
        current = current instanceof Error ? current.cause : undefined;
    }
    return false;
}
