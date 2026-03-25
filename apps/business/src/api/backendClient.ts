import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { getSafeAuthToken, useAuthStore } from "@/stores/authStore";

/**
 * Treaty client with authentication tokens if present
 */
export const authenticatedBackendApi = treaty<App>(
    process.env.BACKEND_URL ?? "https://localhost:3030",
    {
        fetch: { credentials: "include" },
        // Auto add the authentication related header if present
        headers(_path, options) {
            // Get our token
            const token = getSafeAuthToken();

            // Build our new headers
            const headers = new Headers(options.headers);
            if (token && !headers.has("x-business-auth")) {
                headers.append("x-business-auth", token);
            }

            // Return the new headers
            return headers;
        },
        // Auto cleanup session on 401 response (skip in demo mode)
        onResponse(response) {
            if (
                response.status === 401 &&
                useAuthStore.getState().token !== "demo-token"
            ) {
                useAuthStore.getState().clearAuth();
            }
        },
    }
).business;
