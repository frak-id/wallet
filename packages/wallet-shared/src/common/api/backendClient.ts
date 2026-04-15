import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { clientIdStore } from "../../stores/clientIdStore";
import { sessionStore } from "../../stores/sessionStore";
import { getSafeSdkSession, getSafeSession } from "../utils/safeSession";

const backendUrl = process.env.BACKEND_URL ?? "https://localhost:3030";

/**
 * Treaty client with authentication tokens if present
 */
export const authenticatedBackendApi = treaty<App>(backendUrl, {
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
    // Auto cleanup session on 401 response (only for auth-critical endpoints)
    onResponse(response) {
        if (response.status === 401) {
            sessionStore.getState().clearSession();
        }
    },
});

export const authenticatedWalletApi = authenticatedBackendApi.user.wallet;
