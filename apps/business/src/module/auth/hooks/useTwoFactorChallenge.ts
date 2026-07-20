import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import {
    AuthError,
    extractAuthErrorCode,
    extractAuthErrorMessage,
} from "@/module/auth/utils/authError";
import type { TwoFactorMethod } from "@/stores/twoFactorStore";

/**
 * `GET /auth/2fa/methods` — the account's actually-enrolled 2FA channels.
 * Works on pending and full sessions, so it's the authoritative list for
 * both the login-completion and step-up modals (the advertised list handed
 * in via the store is only a hint, and the Shopify SSO path has none).
 */
export function useEnrolledTwoFactorMethods(enabled: boolean) {
    return useQuery({
        queryKey: ["auth", "2fa", "methods"],
        enabled,
        queryFn: async () => {
            const { data, error } =
                await authenticatedBackendApi.auth["2fa"].methods.get();
            if (error) throw new Error("Could not load 2FA methods");
            return data.methods;
        },
    });
}

/**
 * `POST /auth/2fa/challenge` — sends an email code, no-ops for TOTP, or
 * issues a SIWE anti-replay nonce (§4.6). Generic across methods; the SIWE
 * verify step signs a message embedding this nonce.
 */
export function useTwoFactorChallenge() {
    return useMutation({
        mutationKey: ["auth", "2fa", "challenge"],
        mutationFn: async (method: TwoFactorMethod) => {
            const { data, error } = await authenticatedBackendApi.auth[
                "2fa"
            ].challenge.post({
                method,
            });
            if (error) {
                throw new AuthError(
                    extractAuthErrorMessage(error, "Could not send code"),
                    extractAuthErrorCode(error)
                );
            }
            return data;
        },
    });
}

/**
 * `POST /auth/2fa/verify` — completes a pending login AND refreshes the
 * step-up window (same endpoint, §4.6/§4.8). `siwe` proof requires a fresh
 * re-sign embedding the nonce from the challenge step.
 */
export function useTwoFactorVerify() {
    const { mutateAsync: siweAuthenticate } = useSiweAuthenticate();

    return useMutation({
        mutationKey: ["auth", "2fa", "verify"],
        mutationFn: async (
            params:
                | { method: "email" | "totp"; proof: string }
                | { method: "siwe"; nonce: string }
        ) => {
            if (params.method === "siwe") {
                const result = await siweAuthenticate({
                    siwe: {
                        statement: "Verify your identity to continue",
                        nonce: params.nonce,
                    },
                });
                const { data, error } = await authenticatedBackendApi.auth[
                    "2fa"
                ].verify.post({
                    method: "siwe",
                    proof: {
                        message: result.message,
                        signature: result.signature,
                    },
                });
                if (error) {
                    throw new AuthError(
                        extractAuthErrorMessage(error, "Verification failed"),
                        extractAuthErrorCode(error)
                    );
                }
                return data;
            }

            const { data, error } = await authenticatedBackendApi.auth[
                "2fa"
            ].verify.post({
                method: params.method,
                proof: params.proof,
            });
            if (error) {
                throw new AuthError(
                    extractAuthErrorMessage(error, "Invalid code"),
                    extractAuthErrorCode(error)
                );
            }
            return data;
        },
    });
}
