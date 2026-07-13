import { Button } from "@frak-labs/design-system/components/Button";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/module/forms/Input";
import {
    useTwoFactorActivate,
    useTwoFactorSetup,
} from "@/module/settings/security/useSecuritySettings";

/**
 * Email-verification code entry — an explicit two-step form reusing the
 * `/2fa/*` surface: `setup{method:email}` sends the code, `activate{method:
 * email}` verifies it and stamps `email_verified_at`.
 *
 *  1. send   — a "send code" button (skipped when a code is already in hand).
 *  2. confirm — enter the code, verify, or resend.
 *
 * Shapes:
 *  - standalone (default) — the `#code=…` deep-link landing page: centered,
 *    titled; a prefilled code auto-submits once; success screen + "continue".
 *  - `embedded` — inline in settings: compact, left-aligned; hands back via
 *    `onVerified` on success (the parent drops the form once the account
 *    refetches as verified).
 */
export function VerifyEmail({
    initialCode,
    onVerified,
    embedded = false,
}: {
    initialCode?: string;
    onVerified?: () => void;
    embedded?: boolean;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [code, setCode] = useState(initialCode ?? "");
    const {
        mutate: verify,
        isPending: isVerifying,
        isSuccess,
        error: verifyError,
    } = useTwoFactorActivate();
    const {
        mutate: sendCode,
        isPending: isSending,
        isSuccess: sent,
        error: sendError,
    } = useTwoFactorSetup();

    // Auto-submit a deep-linked code exactly once.
    const autoSubmitted = useRef(false);
    useEffect(() => {
        if (autoSubmitted.current) return;
        const trimmed = initialCode?.trim();
        if (!trimmed || trimmed.length < 6) return;
        autoSubmitted.current = true;
        verify({ method: "email", proof: trimmed });
    }, [initialCode, verify]);

    // Embedded: let the parent render the confirmation as soon as verified.
    useEffect(() => {
        if (isSuccess && embedded) onVerified?.();
    }, [isSuccess, embedded, onVerified]);

    const step = (
        <CodeStep
            // A deep-linked code means one is in hand — skip the send step.
            codeReady={sent || !!initialCode}
            embedded={embedded}
            code={code}
            onCodeChange={setCode}
            verifyError={verifyError?.message}
            isVerifying={isVerifying}
            isSending={isSending}
            onVerify={() => verify({ method: "email", proof: code.trim() })}
            onSend={() => sendCode("email")}
        />
    );
    const errorNotice = sendError ? (
        <Notice tone="error">{sendError.message}</Notice>
    ) : null;

    // --- embedded (settings) ---
    if (embedded) {
        return isSuccess ? null : (
            <Stack space="xs">
                {step}
                {errorNotice}
            </Stack>
        );
    }

    // --- standalone deep-link landing page ---
    if (isSuccess) {
        return (
            <Stack space="m" align="center">
                <Notice tone="success">{t("auth.verifyEmail.success")}</Notice>
                <Button
                    variant="primary"
                    width="auto"
                    onClick={() =>
                        onVerified
                            ? onVerified()
                            : navigate({ to: "/dashboard" })
                    }
                >
                    {t("auth.verifyEmail.continue")}
                </Button>
            </Stack>
        );
    }

    return (
        <Stack space="m" align="center">
            <Stack space="xs" align="center">
                <Text as="h1" variant="heading1">
                    {t("auth.verifyEmail.title")}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {t("auth.verifyEmail.hint")}
                </Text>
            </Stack>
            {isVerifying && autoSubmitted.current ? <Spinner /> : step}
            {errorNotice}
        </Stack>
    );
}

/** Step 1 (send) or step 2 (enter + verify + resend), per `codeReady`. */
function CodeStep({
    codeReady,
    embedded,
    code,
    onCodeChange,
    verifyError,
    isVerifying,
    isSending,
    onVerify,
    onSend,
}: {
    codeReady: boolean;
    embedded: boolean;
    code: string;
    onCodeChange: (value: string) => void;
    verifyError?: string;
    isVerifying: boolean;
    isSending: boolean;
    onVerify: () => void;
    onSend: () => void;
}) {
    const { t } = useTranslation();
    const buttonSize = embedded ? "small" : "large";
    const buttonWidth = embedded ? "auto" : "full";

    if (!codeReady) {
        return (
            <Button
                variant={embedded ? "secondary" : "primary"}
                width={buttonWidth}
                size={buttonSize}
                loading={isSending}
                disabled={isSending}
                onClick={onSend}
            >
                {t("auth.verifyEmail.sendCode")}
            </Button>
        );
    }

    return (
        <Stack space="xs">
            <Input
                variant="bare"
                tone="muted"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                label={t("auth.twoFactor.codePlaceholder")}
                error={Boolean(verifyError)}
                hint={verifyError}
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
            />
            <Button
                variant="primary"
                width={buttonWidth}
                size={buttonSize}
                loading={isVerifying}
                disabled={code.trim().length < 6 || isVerifying}
                onClick={onVerify}
            >
                {t("auth.twoFactor.verify")}
            </Button>
            <Button
                variant="ghost"
                size="small"
                width="auto"
                loading={isSending}
                disabled={isSending}
                onClick={onSend}
            >
                {t("auth.verifyEmail.resend")}
            </Button>
        </Stack>
    );
}
