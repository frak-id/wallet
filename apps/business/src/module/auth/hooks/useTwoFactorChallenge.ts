import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import type { TwoFactorMethod } from "@/stores/twoFactorStore";

/**
 * Extract a readable message from an Eden error payload.
 */
export function extractAuthErrorMessage(
    error: unknown,
    fallback: string
): string {
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "value" in error) {
        const { value } = error as { value: unknown };
        if (typeof value === "string") return value;
        if (value && typeof value === "object" && "message" in value) {
            const { message } = value as { message: unknown };
            if (typeof message === "string") return message;
        }
    }
    return fallback;
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
                throw new Error(
                    extractAuthErrorMessage(error, "Could not send code")
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
                    throw new Error(
                        extractAuthErrorMessage(error, "Verification failed")
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
                throw new Error(extractAuthErrorMessage(error, "Invalid code"));
            }
            return data;
        },
    });
}
