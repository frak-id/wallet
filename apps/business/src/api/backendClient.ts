import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { getSafeAuthToken, useAuthStore } from "@/stores/authStore";
import type { TwoFactorMethod } from "@/stores/twoFactorStore";
import { useTwoFactorStore } from "@/stores/twoFactorStore";

/** Mirrors `services/backend/src/infrastructure/macro/authError.ts`. */
const AUTH_ERROR_HEADER = "x-frak-auth-error";
const STEP_UP_ERROR_CODE = "step-up-required";

type StepUpBody = { error: "step_up_required"; methods: TwoFactorMethod[] };

async function readStepUpMethods(
    response: Response
): Promise<TwoFactorMethod[] | null> {
    if (response.headers.get(AUTH_ERROR_HEADER) !== STEP_UP_ERROR_CODE) {
        return null;
    }
    try {
        const body = (await response.clone().json()) as StepUpBody;
        return body.methods ?? [];
    } catch {
        return [];
    }
}

/**
 * Eden treaty can't replay a request from `onResponse`, so step-up handling
 * wraps the underlying `fetch` instead (design doc §4.5): on a
 * `step-up-required` 401, open the shared 2FA modal and transparently retry
 * the original request once it resolves. Exported for direct unit testing.
 */
export async function stepUpAwareFetch(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const response = await fetch(input, init);
    if (response.status !== 401) return response;

    const methods = await readStepUpMethods(response);
    if (!methods) return response;

    const verified = await useTwoFactorStore
        .getState()
        .requestVerification(methods);
    if (!verified) return response;

    return fetch(input, init);
}

/**
 * Treaty client with authentication tokens if present
 */
export const authenticatedBackendApi = treaty<App>(
    process.env.BACKEND_URL ?? "https://localhost:3030",
    {
        fetch: { credentials: "include" },
        fetcher: stepUpAwareFetch,
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
        // Auto cleanup session on 401 response (skip in demo mode and on
        // step-up challenges — those are handled by `stepUpAwareFetch`
        // above and must not blow away the session).
        onResponse(response) {
            if (
                response.status === 401 &&
                response.headers.get(AUTH_ERROR_HEADER) !==
                    STEP_UP_ERROR_CODE &&
                useAuthStore.getState().token !== "demo-token"
            ) {
                useAuthStore.getState().clearAuth();
            }
        },
    }
).business;

/** Base URL for full-page navigations to backend-driven flows (Shopify OAuth). */
export const backendBaseUrl =
    process.env.BACKEND_URL ?? "https://localhost:3030";
