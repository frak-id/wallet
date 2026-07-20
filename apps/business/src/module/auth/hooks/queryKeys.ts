/**
 * Query-key builders for the `auth` namespace. Colocated so the hooks that
 * read account/session/2FA state and the mutations that invalidate them can
 * never drift on key shape. Shared across the auth and settings/security
 * modules so a key like the 2FA-methods list has a single source of truth.
 */

/** Full account credential set (`["auth", "account"]`). */
export function authAccountQueryKey() {
    return ["auth", "account"] as const;
}

/** Active session list (`["auth", "sessions"]`). */
export function authSessionsQueryKey() {
    return ["auth", "sessions"] as const;
}

/** Enrolled 2FA methods (`["auth", "2fa", "methods"]`). */
export function twoFactorMethodsQueryKey() {
    return ["auth", "2fa", "methods"] as const;
}

/** Invitation-token preview (`["auth", "invite", "preview", token]`). */
export function invitePreviewQueryKey(token: string | undefined) {
    return ["auth", "invite", "preview", token] as const;
}
