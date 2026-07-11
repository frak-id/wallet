import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { getSafeAuthToken, useAuthStore } from "@/stores/authStore";
import type { TwoFactorMethod } from "@/stores/twoFactorStore";
import { useTwoFactorStore } from "@/stores/twoFactorStore";

/** Mirrors `services/backend/src/infrastructure/macro/authError.ts`. */
const AUTH_ERROR_HEADER = "x-frak-auth-error";
const AUTH_METHODS_HEADER = "x-frak-auth-methods";
const STEP_UP_ERROR_CODE = "step-up-required";

/**
 * Backend `code`s for a *validation* failure inside the 2FA flow (a wrong OTP
 * code or a bad SIWE proof). These arrive as 401s but the session is still
 * valid — the user merely failed a challenge — so they must never trigger the
 * auto-logout below; the modal surfaces the message and lets them retry.
 * Kept in sync with `services/backend/src/api/business/auth/twoFactor.ts`.
 */
const TWO_FACTOR_VALIDATION_CODES = new Set<string>([
    "INVALID_TWO_FACTOR_PROOF",
    "INVALID_TWO_FACTOR_CODE",
]);

type Parsed401 = {
    /** A step-up challenge (needs the 2FA modal) rather than a dead session. */
    isStepUp: boolean;
    /** Methods offered by a step-up challenge, from the methods header. */
    methods: TwoFactorMethod[];
    /** Typed backend error `code`, when the body carried one. */
    code?: string;
};

/** Parse the comma-separated `x-frak-auth-methods` step-up header. */
function parseAuthMethods(header: string | null): TwoFactorMethod[] {
    if (!header) return [];
    return header
        .split(",")
        .map((method) => method.trim())
        .filter(Boolean) as TwoFactorMethod[];
}

/**
 * Classify a 401. A step-up challenge is signalled entirely by headers
 * (`x-frak-auth-error: step-up-required` + `x-frak-auth-methods`), so it is
 * recognised without touching the body — a cancelled step-up is never mistaken
 * for an expired session. Only for non-step-up 401s do we read the body once
 * for its typed `code` (to spare 2FA validation failures from auto-logout).
 * Exported for direct unit testing.
 */
export async function parse401(response: Response): Promise<Parsed401> {
    if (response.headers.get(AUTH_ERROR_HEADER) === STEP_UP_ERROR_CODE) {
        return {
            isStepUp: true,
            methods: parseAuthMethods(
                response.headers.get(AUTH_METHODS_HEADER)
            ),
        };
    }
    let code: string | undefined;
    try {
        const body = (await response.clone().json()) as { code?: string };
        code = body?.code;
    } catch {
        code = undefined;
    }
    return { isStepUp: false, methods: [], code };
}

/**
 * Build the `x-business-auth` header carrying the current session token, if
 * any. Shared by the Eden `headers()` hook and any raw (non-Eden) fetch that
 * needs the same header — previously hand-rolled separately in each caller.
 */
export function businessAuthHeaders(): Record<string, string> {
    const token = getSafeAuthToken();
    return token ? { "x-business-auth": token } : {};
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

    const { isStepUp, methods } = await parse401(response);
    if (!isStepUp) return response;

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
        // `stepUpAwareFetch` implements the call signature but not fetch's
        // static `preconnect` sibling (unused by treaty).
        fetcher: stepUpAwareFetch as typeof fetch,
        // Auto add the authentication related header if present
        headers(_path, options) {
            // Build our new headers
            const headers = new Headers(options.headers);
            if (!headers.has("x-business-auth")) {
                const { "x-business-auth": token } = businessAuthHeaders();
                if (token) headers.append("x-business-auth", token);
            }

            // Return the new headers
            return headers;
        },
        // Auto cleanup session on 401 response. Skipped in demo mode, while a
        // login is pending 2FA, and — crucially — for any step-up challenge or
        // 2FA validation failure: those return a 401 while the session is
        // still valid (the user merely cancelled a step-up or mistyped a
        // code/proof), so blowing the token away would wrongly lock them out.
        // `parse401` inspects the step-up headers and the typed error `code`
        // to tell these apart from a genuine dead session.
        async onResponse(response) {
            if (response.status !== 401) return;
            const { token, pending2fa } = useAuthStore.getState();
            if (token === "demo-token" || pending2fa) return;
            const { isStepUp, code } = await parse401(response);
            // Step-up challenge → the 2FA modal handles it, keep the session.
            if (isStepUp) return;
            // 2FA validation failure (wrong code / bad proof) → surface the
            // error, but the session is intact so do not disconnect.
            if (code && TWO_FACTOR_VALIDATION_CODES.has(code)) return;
            useAuthStore.getState().clearAuth();
        },
    }
).business;

/** Base URL for full-page navigations to backend-driven flows (Shopify OAuth). */
export const backendBaseUrl =
    process.env.BACKEND_URL ?? "https://localhost:3030";
