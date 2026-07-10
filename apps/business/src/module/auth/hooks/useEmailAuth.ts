import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { extractAuthErrorMessage } from "@/module/auth/utils/authError";
import { useAuthStore } from "@/stores/authStore";
import { useTwoFactorStore } from "@/stores/twoFactorStore";

/**
 * `POST /auth/register` — enumeration-safe: always returns the same generic
 * message (§4.6), whether or not the email was already registered.
 */
export function useRegisterAccount() {
    return useMutation({
        mutationKey: ["auth", "register"],
        mutationFn: async (params: { email: string; password: string }) => {
            const { data, error } =
                await authenticatedBackendApi.auth.register.post(params);
            if (error) {
                throw new Error(
                    extractAuthErrorMessage(error, "Registration failed")
                );
            }
            return data;
        },
    });
}

/**
 * `POST /auth/login/password` — always returns a pending (2FA-unverified)
 * session (§4.8): the caller must complete `/auth/2fa/verify` next.
 */
export function usePasswordLogin() {
    return useMutation({
        mutationKey: ["auth", "login", "password"],
        mutationFn: async (params: { email: string; password: string }) => {
            const { data, error } =
                await authenticatedBackendApi.auth.login.password.post(params);
            if (error) {
                throw new Error(
                    extractAuthErrorMessage(error, "Invalid credentials")
                );
            }

            // Pending session: stored so the 2FA screen can call
            // `/auth/2fa/*` (which accepts pending sessions), but
            // `isAuthenticated()` stays false until 2FA completes.
            useAuthStore.getState().setAuth({
                token: data.token,
                authMethod: "password",
                expiresAt: data.expiresAt,
                pending2fa: true,
            });
            // The 200 response already lists the account's enabled methods
            // (§4.6) — handed to `/login/2fa` via the store instead of guessing.
            useTwoFactorStore.getState().setPendingLoginMethods(data.methods);

            return data;
        },
    });
}
