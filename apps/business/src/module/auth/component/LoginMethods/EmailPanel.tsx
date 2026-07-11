import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    useConfirmPasswordReset,
    usePasswordLogin,
    useRegisterAccount,
    useRequestPasswordReset,
} from "@/module/auth/hooks/useEmailAuth";
import { Input } from "@/module/forms/Input";
import {
    MIN_PASSWORD_LENGTH,
    PasswordInput,
} from "@/module/forms/PasswordInput";

export function EmailPanel({ redirect }: { redirect?: string }) {
    const [mode, setMode] = useState<"login" | "register" | "forgot">("login");

    if (mode === "register") {
        return (
            <RegisterForm
                redirect={redirect}
                onBackToLogin={() => setMode("login")}
            />
        );
    }
    if (mode === "forgot") {
        return <ForgotPasswordForm onBackToLogin={() => setMode("login")} />;
    }
    return (
        <LoginForm
            redirect={redirect}
            onRegister={() => setMode("register")}
            onForgotPassword={() => setMode("forgot")}
        />
    );
}

function LoginForm({
    redirect,
    onRegister,
    onForgotPassword,
}: {
    redirect?: string;
    onRegister: () => void;
    onForgotPassword: () => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { mutate: login, isPending, error } = usePasswordLogin();

    const onSubmit = () => {
        login(
            { email, password },
            {
                onSuccess: () => {
                    // Carry the redirect through 2FA so the completion step
                    // lands on the originally-requested page (§2.5).
                    navigate({
                        to: "/login/2fa",
                        search: redirect ? { redirect } : {},
                    });
                },
            }
        );
    };

    return (
        <Stack space="s">
            <Input
                variant="bare"
                tone="muted"
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                label={t("auth.login.email.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            <PasswordInput
                variant="bare"
                tone="muted"
                autoComplete="current-password"
                label={t("auth.login.email.passwordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={Boolean(error)}
                hint={error ? error.message : undefined}
            />
            <Button
                variant="primary"
                size="large"
                width="full"
                loading={isPending}
                disabled={!email || !password || isPending}
                onClick={onSubmit}
            >
                {t("auth.login.email.submit")}
            </Button>
            <Inline space="s" align="space-between" alignY="center">
                <Button
                    variant="ghost"
                    size="small"
                    width="auto"
                    onClick={onForgotPassword}
                >
                    {t("auth.login.email.forgotPassword")}
                </Button>
                <Inline space="xxs" alignY="center">
                    <Text variant="bodySmall" color="secondary">
                        {t("auth.login.email.noAccount")}
                    </Text>
                    <Button
                        variant="ghost"
                        size="small"
                        width="auto"
                        onClick={onRegister}
                    >
                        {t("auth.login.email.registerCta")}
                    </Button>
                </Inline>
            </Inline>
        </Stack>
    );
}

/**
 * Forgotten-password recovery (§P1): a two-step form — request an emailed OTP,
 * then submit that code with a new password. The request step is
 * enumeration-safe server-side, so we always advance to the code step.
 */
function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin: () => void }) {
    const { t } = useTranslation();
    const [step, setStep] = useState<"request" | "confirm">("request");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");

    const {
        mutate: requestReset,
        isPending: isRequesting,
        error: requestError,
    } = useRequestPasswordReset();
    const {
        mutate: confirmReset,
        isPending: isConfirming,
        error: confirmError,
        isSuccess,
    } = useConfirmPasswordReset();

    if (isSuccess) {
        return (
            <Stack space="s">
                <Notice tone="success">
                    {t("auth.login.email.resetSuccess")}
                </Notice>
                <BackToLoginButton onClick={onBackToLogin} />
            </Stack>
        );
    }

    if (step === "request") {
        return (
            <Stack space="s">
                <Text variant="bodySmall" color="secondary">
                    {t("auth.login.email.resetInstructions")}
                </Text>
                <Input
                    variant="bare"
                    tone="muted"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    label={t("auth.login.email.emailPlaceholder")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    error={Boolean(requestError)}
                    hint={requestError ? requestError.message : undefined}
                />
                <Button
                    variant="primary"
                    size="large"
                    width="full"
                    loading={isRequesting}
                    disabled={!email || isRequesting}
                    onClick={() =>
                        requestReset(
                            { email },
                            { onSuccess: () => setStep("confirm") }
                        )
                    }
                >
                    {t("auth.login.email.sendResetCode")}
                </Button>
                <BackToLoginButton onClick={onBackToLogin} />
            </Stack>
        );
    }

    return (
        <Stack space="s">
            <Text variant="bodySmall" color="secondary">
                {t("auth.login.email.resetSent")}
            </Text>
            <Input
                variant="bare"
                tone="muted"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                label={t("auth.login.email.resetCodePlaceholder")}
                value={code}
                onChange={(event) => setCode(event.target.value)}
            />
            <PasswordInput
                variant="bare"
                tone="muted"
                autoComplete="new-password"
                label={t("auth.login.email.newPasswordPlaceholder")}
                hint={
                    confirmError
                        ? confirmError.message
                        : t("auth.login.email.passwordHint")
                }
                error={Boolean(confirmError)}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
            <Button
                variant="primary"
                size="large"
                width="full"
                loading={isConfirming}
                disabled={
                    !code ||
                    password.length < MIN_PASSWORD_LENGTH ||
                    isConfirming
                }
                onClick={() => confirmReset({ email, code, password })}
            >
                {t("auth.login.email.resetSubmit")}
            </Button>
            <BackToLoginButton onClick={onBackToLogin} />
        </Stack>
    );
}

function RegisterForm({
    redirect,
    onBackToLogin,
}: {
    redirect?: string;
    onBackToLogin: () => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { mutate: register, isPending, error } = useRegisterAccount();
    const { mutate: login, isPending: isLoggingIn } = usePasswordLogin();

    // Register → immediately log in with the same credentials → land on the
    // 2FA step (the first email OTP doubles as the email ownership proof).
    // The register response is enumeration-safe (generic 200 either way), so
    // an already-taken email simply fails the login with "Invalid
    // credentials" — no dead-end "check your email" screen.
    const onSubmit = () => {
        register(
            { email, password },
            {
                onSuccess: () =>
                    login(
                        { email, password },
                        {
                            onSuccess: () =>
                                navigate({
                                    to: "/login/2fa",
                                    search: redirect ? { redirect } : {},
                                }),
                            onError: onBackToLogin,
                        }
                    ),
            }
        );
    };

    const busy = isPending || isLoggingIn;

    return (
        <Stack space="s">
            <Input
                variant="bare"
                tone="muted"
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                label={t("auth.login.email.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            <PasswordInput
                variant="bare"
                tone="muted"
                autoComplete="new-password"
                label={t("auth.login.email.newPasswordPlaceholder")}
                hint={
                    error ? error.message : t("auth.login.email.passwordHint")
                }
                error={Boolean(error)}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
            <Button
                variant="primary"
                size="large"
                width="full"
                loading={busy}
                disabled={
                    !email || password.length < MIN_PASSWORD_LENGTH || busy
                }
                onClick={onSubmit}
            >
                {t("auth.login.email.registerSubmit")}
            </Button>
            <BackToLoginButton onClick={onBackToLogin} />
        </Stack>
    );
}

function BackToLoginButton({ onClick }: { onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <Button variant="ghost" size="small" width="auto" onClick={onClick}>
            {t("auth.login.email.backToLogin")}
        </Button>
    );
}
