import {
    getSafeSdkSession,
    getSafeSession,
} from "@/module/listener/utils/localStorage";
import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";

/**
 * Treaty client with authentication tokens if present
 */
export const authenticatedBackendApi = treaty<App>(
    process.env.BACKEND_URL ?? "http://localhost:3030",
    {
        fetch: { credentials: "include" },
        // Auto add the authentication related header if present
        onRequest(_, options) {
            // todo: check if auth related path

            // Get shit from our tokens
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

            // Set them on the options and return
            options.headers = headers;
            return options;
        },
        // todo: on 401 cleanup sessions
    }
);
