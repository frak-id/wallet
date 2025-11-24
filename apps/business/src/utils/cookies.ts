/**
 * Cookie utilities for auth token management
 * Syncs auth state between client (localStorage) and server (cookies)
 * Demo mode is determined by checking if token === "demo-token"
 */

const AUTH_COOKIE_NAME = "business-auth";

/**
 * Set auth cookie (client-side only)
 * Call this whenever auth state changes
 */
export function setAuthCookie(token: string, expiresAt: number): void {
    if (typeof document === "undefined") return;

    const maxAge = Math.floor((expiresAt - Date.now()) / 1000); // Convert to seconds

    // Set the auth token cookie
    document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
}

/**
 * Clear auth cookie (client-side only)
 * Call this when logging out
 */
export function clearAuthCookie(): void {
    if (typeof document === "undefined") return;

    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
}
