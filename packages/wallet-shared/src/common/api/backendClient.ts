import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { clientIdStore } from "../../stores/clientIdStore";
import { notifyWalletAuthExpired } from "../auth/authRecovery";
import { getSafeSdkSession, getSafeSession } from "../utils/safeSession";
import { getTokenExpMs } from "../utils/tokenExpiry";

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
    // is dead, so the app layer can surface a re-auth modal. We do NOT call
    // clearSession() here — the guard layer owns that decision. Network / 5xx
    // errors do not reach onResponse (Eden returns status 503 from the catch
    // block without calling this hook), so transient errors never notify.
    onResponse(response) {
        if (response.status !== 401) return;

        // Preferred signal: the backend tags every auth-macro 401 with which
        // credential failed (CORS-exposed `x-frak-auth-error`). When present
        // it's authoritative and removes all guesswork:
        //  - `sdk-token-invalid`    → only the short-lived SDK token died; the
        //    wallet session is fine. ensureFreshSdkSession owns recovery; we
        //    must NOT force re-auth.
        //  - `wallet-token-invalid` → the wallet session is dead (missing /
        //    expired / revoked / secret-rotated) on ANY wallet-token route, so
        //    a JWT-secret rotation is caught on the first request, not just on
        //    a /generate call.
        const authError = response.headers.get("x-frak-auth-error");
        if (authError === "sdk-token-invalid") return;
        if (authError === "wallet-token-invalid") {
            notifyWalletAuthExpired();
            return;
        }

        // Fallback heuristic for un-annotated routes (e.g. SDK-facing tracking
        // endpoints) or contexts where an intermediary strips the header.
        const walletToken = getSafeSession()?.token;

        // `/wallet/auth/sdk/generate` authenticates with the wallet token
        // (withWalletAuthent on the backend), so a 401 from it is the server's
        // AUTHORITATIVE verdict that the wallet token is dead — even when its
        // client-decoded `exp` is still in the future. This is what forces a
        // re-login after a JWT-secret rotation that invalidates every live
        // session, a server-side revocation, or a corrupt token: client-side
        // `exp` is never authoritative for "dead" (authority principle).
        const serverRejectedWalletToken = response.url.includes(
            "/wallet/auth/sdk/generate"
        );

        // For this (non-destructive) notify decision we fail CLOSED on an
        // undecodable token: a corrupt/garbage wallet token (exp === null)
        // can't be trusted and must surface re-auth rather than be silently
        // swallowed. (`isExpired` fails open by design for destructive
        // decisions — the opposite trade-off, which is why it isn't reused
        // here.)
        const expMs = walletToken ? getTokenExpMs(walletToken) : null;
        const walletTokenUnusable =
            !walletToken || expMs === null || Date.now() > expMs;

        // Any other 401 with a healthy-looking wallet token is SDK-token-scoped
        // (withWalletSdkAuthent routes) and owned by ensureFreshSdkSession — it
        // must NOT force wallet re-auth here.
        if (serverRejectedWalletToken || walletTokenUnusable) {
            notifyWalletAuthExpired();
        }
    },
});

export const authenticatedWalletApi = authenticatedBackendApi.user.wallet;
