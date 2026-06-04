import type { SendEmailVerificationResponse } from "@frak-labs/backend-elysia/api/schemas";
import { authenticatedWalletApi, authKey } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

const RESEND_COOLDOWN_MS = 30_000;

/**
 * Send (or resend) an email-verification code. Owns the 30s resend cooldown:
 * it starts after a `sent` result and is reconciled to the server's
 * `retryAfterSec` whenever the backend reports `throttled`, so the button stays
 * disabled for the authoritative remaining window even across remounts.
 */
export function useSendEmailVerification() {
    const [cooldownUntil, setCooldownUntil] = useState(0);
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        if (cooldownUntil <= Date.now()) return;
        const id = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(id);
    }, [cooldownUntil]);

    const mutation = useMutation<
        SendEmailVerificationResponse,
        Error,
        string | undefined
    >({
        mutationKey: authKey.sendEmailVerification,
        mutationFn: async (email) => {
            const { data, error } =
                await authenticatedWalletApi.auth.email.verification.post({
                    email,
                });
            if (error) throw error;
            return data;
        },
        onSuccess: (result) => {
            if (result.status === "sent") {
                setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
            } else if (result.status === "throttled") {
                setCooldownUntil(Date.now() + result.retryAfterSec * 1000);
            }
        },
    });

    const sendCode = useCallback(
        (email?: string) => mutation.mutateAsync(email),
        [mutation.mutateAsync]
    );

    const cooldownSeconds = Math.max(
        0,
        Math.ceil((cooldownUntil - nowMs) / 1000)
    );

    return {
        sendCode,
        isSending: mutation.isPending,
        error: mutation.error,
        data: mutation.data,
        reset: mutation.reset,
        cooldownSeconds,
    };
}
