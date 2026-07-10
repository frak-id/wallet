import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { extractAuthErrorMessage } from "@/module/auth/hooks/useTwoFactorChallenge";
import type { TwoFactorMethod } from "@/stores/twoFactorStore";

const SESSIONS_QUERY_KEY = ["auth", "sessions"];

/** `GET /auth/sessions` — active session list, current one flagged. */
export function useAuthSessions() {
    return useQuery({
        queryKey: SESSIONS_QUERY_KEY,
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
            queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
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
    });
}

/** `POST /auth/link/password` — add email+password to an SSO-only account. */
export function useLinkPassword() {
    return useMutation({
        mutationKey: ["auth", "link", "password"],
        mutationFn: async (params: { email: string; password: string }) => {
            const { data, error } =
                await authenticatedBackendApi.auth.link.password.post(params);
            if (error) {
                throw new Error(
                    extractAuthErrorMessage(error, "Could not add password")
                );
            }
            return data;
        },
    });
}
