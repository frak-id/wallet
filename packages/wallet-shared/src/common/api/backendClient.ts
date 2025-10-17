import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { RESET } from "jotai/utils";
import { sdkSessionAtom, sessionAtom } from "../atoms/session";
import { getSafeSdkSession, getSafeSession } from "../utils/safeSession";

/**
 * Treaty client with authentication tokens if present
 */
export const authenticatedBackendApi = treaty<App>(
    process.env.BACKEND_URL ?? "http://localhost:3030",
    {
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
        // Auto cleanup session on 401 response
        onResponse(response) {
            if (response.status === 401) {
                jotaiStore.set(sessionAtom, RESET);
                jotaiStore.set(sdkSessionAtom, RESET);
            }
        },
    }
);

export const authenticatedWalletApi = authenticatedBackendApi.wallet;
