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
        const token = getSafeSession()?.token;
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
            const url = response.url;
            // Don't clear session for balance/tokens endpoints - they may fail with mobile auth
            // token which is an SDK JWT, not a wallet auth token
            const isNonAuthEndpoint =
                url.includes("/wallet/balance") ||
                url.includes("/wallet/tokens");
            if (isNonAuthEndpoint) {
                return;
            }
            sessionStore.getState().clearSession();
        }
    },
});

export const authenticatedWalletApi = authenticatedBackendApi.wallet;
