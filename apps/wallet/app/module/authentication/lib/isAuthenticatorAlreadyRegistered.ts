/**
 * Check if a registration error indicates the authenticator is already registered.
 *
 * WebAuthn spec throws InvalidStateError when excludeCredentials matches,
 * but the error gets wrapped differently per platform:
 *
 * - iOS/Web: CredentialCreationFailedError → DOMException("InvalidStateError")
 * - Android Tauri: CredentialCreationFailedError → BaseError → normalizedError
 *
 * This walks the full cause chain looking for InvalidStateError by name or message.
 */
export function isAuthenticatorAlreadyRegistered(error: Error): boolean {
    let current: unknown = error;
    // Walk up to 5 levels of cause chain
    for (let i = 0; i < 5 && current; i++) {
        if (
            current instanceof DOMException &&
            current.name === "InvalidStateError"
        ) {
            return true;
        }
        if (
            current instanceof Error &&
            current.message.includes("InvalidStateError")
        ) {
            return true;
        }
        current = current instanceof Error ? current.cause : undefined;
    }
    return false;
}
