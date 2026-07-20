import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import {
    authAccountQueryKey,
    authSessionsQueryKey,
    twoFactorMethodsQueryKey,
} from "@/module/auth/hooks/queryKeys";
import {
    AuthError,
    extractAuthErrorCode,
    extractAuthErrorMessage,
} from "@/module/auth/utils/authError";
import type { TwoFactorMethod } from "@/stores/twoFactorStore";

/**
 * `GET /auth/account` — the account's full credential set (email + verified
 * flag, password, wallet, shopify). The session token alone can't tell the
 * client this (a SIWE session that later added a password still reports
 * `authMethod: "siwe"`), so the linked-credentials UI reads it from here.
 */
export function useAccountCredentials() {
    return useQuery({
        queryKey: authAccountQueryKey(),
        queryFn: async () => {
            const { data, error } =
                await authenticatedBackendApi.auth.account.get();
            if (error) throw new Error("Could not load account");
            return data;
        },
    });
}

/** `GET /auth/sessions` — active session list, current one flagged. */
export function useAuthSessions() {
    return useQuery({
        queryKey: authSessionsQueryKey(),
        queryFn: async () => {
            const { data, error } =
                await authenticatedBackendApi.auth.sessions.get();
            if (error) throw new Error("Could not load sessions");
            return data;
        },
    });
}

/** `DELETE /auth/sessions/:id` — logout-everywhere building block. */
export function useRevokeSession() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["auth", "sessions", "revoke"],
        mutationFn: async (sessionId: string) => {
            const { error } = await authenticatedBackendApi.auth
                .sessions({
                    id: sessionId,
                })
                .delete();
            if (error) {
                throw new Error(
                    extractAuthErrorMessage(error, "Could not revoke session")
                );
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: authSessionsQueryKey() });
        },
    });
}

/**
 * `POST /auth/2fa/setup` — TOTP enrollment start (step-up guarded
 * server-side, §4.8) or an email confirmation code.
 */
export function useTwoFactorSetup() {
    return useMutation({
        mutationKey: ["auth", "2fa", "setup"],
        mutationFn: async (method: TwoFactorMethod) => {
            const { data, error } = await authenticatedBackendApi.auth[
                "2fa"
            ].setup.post({
                method,
            });
            if (error) {
                throw new Error(
                    extractAuthErrorMessage(error, "Could not start enrollment")
                );
            }
            return data;
        },
    });
}

/**
 * `POST /auth/2fa/activate` — confirms enrollment; TOTP returns one-time
 * recovery codes that must be shown exactly once.
 */
export function useTwoFactorActivate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["auth", "2fa", "activate"],
        mutationFn: async (params: {
            method: "email" | "totp";
            proof: string;
        }) => {
            const { data, error } =
                await authenticatedBackendApi.auth["2fa"].activate.post(params);
            if (error) {
                throw new Error(extractAuthErrorMessage(error, "Invalid code"));
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: twoFactorMethodsQueryKey(),
            });
            // Email activation flips emailVerified / completes the add-email
            // flow — refresh the linked-credentials view.
            queryClient.invalidateQueries({ queryKey: authAccountQueryKey() });
        },
    });
}

/** `POST /auth/link/password` — add email+password to an SSO-only account. */
export function useLinkPassword() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["auth", "link", "password"],
        mutationFn: async (params: { email: string; password: string }) => {
            const { data, error } =
                await authenticatedBackendApi.auth.link.password.post(params);
            if (error) {
                // Preserve the backend `code` (e.g. EMAIL_TAKEN) so the
                // linking UI can show a translated message (§2.1).
                throw new AuthError(
                    extractAuthErrorMessage(error, "Could not add password"),
                    extractAuthErrorCode(error)
                );
            }
            return data;
        },
        onSuccess: () => {
            // Password added, email now attached-but-pending — refresh the
            // linked-credentials view so it flips to the pending row + the
            // (single) verify form.
            queryClient.invalidateQueries({ queryKey: authAccountQueryKey() });
        },
    });
}
