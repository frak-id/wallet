import { EMAIL_VERIFICATION } from "@frak-labs/app-essentials/constants/emailVerification";
import type { SendEmailVerificationResponse } from "@frak-labs/backend-elysia/api/schemas";
import { authenticatedWalletApi, authKey } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

/**
 * Send (or resend) an email-verification code. Owns the resend cooldown: it
 * starts after a `sent` result and is reconciled to the server's
 * `retryAfterSec` whenever the backend reports `throttled`.
 *
 * The cooldown is component-local state, so it resets on remount — the
 * server-side debounce (surfaced as `throttled`) is the durable backstop that
 * keeps a remounted client from sending again too soon.
 */
export function useSendEmailVerification() {
    const [cooldownUntil, setCooldownUntil] = useState(0);
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        if (cooldownUntil <= Date.now()) return;
        // Tick once a second, and stop the interval the moment the window
        // elapses — otherwise it would keep firing (a render per second)
        // forever, since the effect only re-runs when `cooldownUntil` changes.
        const id = setInterval(() => {
            const now = Date.now();
            setNowMs(now);
            if (now >= cooldownUntil) clearInterval(id);
        }, 1000);
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
                setCooldownUntil(
                    Date.now() + EMAIL_VERIFICATION.RESEND_DEBOUNCE_MS
                );
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
