import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { sessionStore } from "../../stores/sessionStore";
import { getSafeSdkSession, getSafeSession } from "../utils/safeSession";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3030";

/**
 * Treaty client with authentication tokens if present
 */
export const authenticatedBackendApi = treaty<App>(backendUrl, {
    fetch: { credentials: "include" },
    // Auto add the authentication related header if present
    headers(_path, options) {
        // Get our tokens
        const session = getSafeSession();
        const token =
            session && session.type !== "mobile-auth"
                ? session.token
                : undefined; // mobile-auth sessions use sdkSession.token instead
        const sdkToken = getSafeSdkSession()?.token;

        // Build our new headers
        const headers = new Headers(options.headers);
        if (token && !headers.has("x-wallet-auth")) {
            headers.append("x-wallet-auth", token);
        }
        if (sdkToken && !headers.has("x-wallet-sdk-auth")) {
            headers.append("x-wallet-sdk-auth", sdkToken);
        }

        // Return the new headers
        return headers;
    },
    // Auto cleanup session on 401 response (only for auth-critical endpoints)
    onResponse(response) {
        if (response.status === 401) {
            // If running with a mobile-auth session, a 401 is not a reliable signal to clear
            // the whole wallet session store (SDK tokens and wallet tokens are distinct).
            const session = getSafeSession();
            if (session?.type === "mobile-auth") return;
            sessionStore.getState().clearSession();
        }
    },
});

export const authenticatedWalletApi = authenticatedBackendApi.user.wallet;
