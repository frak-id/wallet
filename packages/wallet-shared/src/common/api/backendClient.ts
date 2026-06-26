import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { clientIdStore } from "../../stores/clientIdStore";
import { notifyWalletAuthExpired } from "../auth/authRecovery";
import { getSafeSdkSession, getSafeSession } from "../utils/safeSession";
import { isExpired } from "../utils/tokenExpiry";

const backendUrl = process.env.BACKEND_URL ?? "https://localhost:3030";

/**
 * Treaty client with authentication tokens if present
 */
export const authenticatedBackendApi = treaty<App>(backendUrl, {
    // credentials:"include" is kept because the backend sets response cookies
    // (e.g. logout) via the session context. Auth itself uses x-wallet-auth /
    // x-wallet-sdk-auth headers, so cookie-blocking in third-party iframes
    // does not affect authentication.
    fetch: { credentials: "include" },
    // Auto add the authentication related header if present
    headers(_path, options) {
        // Get our tokens
        const session = getSafeSession();
        const token = session?.token;
        const sdkToken = getSafeSdkSession()?.token;
        const clientId = clientIdStore.getState().clientId;

        // Build our new headers
        const headers = new Headers(options.headers);
        if (token && !headers.has("x-wallet-auth")) {
            headers.append("x-wallet-auth", token);
        }
        if (sdkToken && !headers.has("x-wallet-sdk-auth")) {
            headers.append("x-wallet-sdk-auth", sdkToken);
        }
        if (clientId && !headers.has("x-frak-client-id")) {
            headers.append("x-frak-client-id", clientId);
        }

        // Return the new headers
        return headers;
    },
    // On HTTP 401: notify the auth-recovery subscribers when the wallet token
    // is absent or expired, so the app layer can surface a re-auth modal.
    // We do NOT call clearSession() here — the guard layer owns that decision.
    // Network / 5xx errors do not reach onResponse (Eden returns status 503
    // from the catch block without calling this hook), so transient errors
    // never produce a notification.
    onResponse(response) {
        if (response.status !== 401) return;

        // Only signal when the wallet token is actually absent or expired.
        // This future-proofs against SDK-only endpoints that return 401 with
        // a valid wallet token (ensureFreshSdkSession owns SDK-token recovery).
        const walletToken = getSafeSession()?.token;
        if (!walletToken || isExpired(walletToken)) {
            notifyWalletAuthExpired();
        }
    },
});

export const authenticatedWalletApi = authenticatedBackendApi.user.wallet;
