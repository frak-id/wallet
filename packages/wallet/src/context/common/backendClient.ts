import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { jotaiStore } from "@module/atoms/store";

/**
 * Treaty client with authentication tokens if present
 */
export const authenticatedBackendApi = treaty<App>(
    process.env.BACKEND_URL ?? "http://localhost:3030",
    {
        fetch: { credentials: "include" },
        // Auto add the authentication related header if present
        onRequest(path, options) {
            // Get shit from our tokens
            const token = jotaiStore.get(sessionAtom)?.token;
            const sdkToken = jotaiStore.get(sdkSessionAtom)?.token;

            // Build our new headers
            const headers = new Headers(options.headers);
            if (token && !headers.has("x-wallet-auth")) {
                headers.append("x-wallet-auth", token);
            }
            if (sdkToken && !headers.has("x-wallet-sdk-auth")) {
                headers.append("x-wallet-sdk-auth", sdkToken);
            }

            // todo: check if auth related path
            console.log("Headers update", {
                path,
                initial: options.headers,
                final: headers,
            });

            // Set them on the options and return
            options.headers = headers;
            return options;
        },
        // todo: on 401 cleanup sessions
    }
);
