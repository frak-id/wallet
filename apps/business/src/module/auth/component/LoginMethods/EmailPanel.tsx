import { Button } from "@frak-labs/design-system/components/Button";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
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

export function EmailPanel({ redirect }: { redirect?: string }) {
    const [mode, setMode] = useState<"login" | "register" | "forgot">("login");

    if (mode === "register") {
        return <RegisterForm onBackToLogin={() => setMode("login")} />;
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
                type="email"
                autoComplete="email"
                placeholder={t("auth.login.email.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            <Input
                type="password"
                autoComplete="current-password"
                placeholder={t("auth.login.email.passwordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
            {error && <FieldError>{error.message}</FieldError>}
            <Button
                variant="primary"
                size="large"
                width="auto"
                loading={isPending}
                disabled={!email || !password || isPending}
                onClick={onSubmit}
            >
                {t("auth.login.email.submit")}
            </Button>
            <Text variant="bodySmall" color="secondary">
                <button type="button" onClick={onForgotPassword}>
                    {t("auth.login.email.forgotPassword")}
                </button>
            </Text>
            <Text variant="bodySmall" color="secondary">
                {t("auth.login.email.noAccount")}{" "}
                <button type="button" onClick={onRegister}>
                    {t("auth.login.email.registerCta")}
                </button>
            </Text>
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
                <Text variant="bodySmall" color="secondary">
                    <button type="button" onClick={onBackToLogin}>
                        {t("auth.login.email.backToLogin")}
                    </button>
                </Text>
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
                    type="email"
                    autoComplete="email"
                    placeholder={t("auth.login.email.emailPlaceholder")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                {requestError && (
                    <FieldError>{requestError.message}</FieldError>
                )}
                <Button
                    variant="primary"
                    size="large"
                    width="auto"
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
                <Text variant="bodySmall" color="secondary">
                    <button type="button" onClick={onBackToLogin}>
                        {t("auth.login.email.backToLogin")}
                    </button>
                </Text>
            </Stack>
        );
    }

    return (
        <Stack space="s">
            <Text variant="bodySmall" color="secondary">
                {t("auth.login.email.resetSent")}
            </Text>
            <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("auth.login.email.resetCodePlaceholder")}
                value={code}
                onChange={(event) => setCode(event.target.value)}
            />
            <Input
                type="password"
                autoComplete="new-password"
                placeholder={t("auth.login.email.newPasswordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
            <Text variant="caption" color="tertiary">
                {t("auth.login.email.passwordHint")}
            </Text>
            {confirmError && <FieldError>{confirmError.message}</FieldError>}
            <Button
                variant="primary"
                size="large"
                width="auto"
                loading={isConfirming}
                disabled={!code || password.length < 10 || isConfirming}
                onClick={() => confirmReset({ email, code, password })}
            >
                {t("auth.login.email.resetSubmit")}
            </Button>
            <Text variant="bodySmall" color="secondary">
                <button type="button" onClick={onBackToLogin}>
                    {t("auth.login.email.backToLogin")}
                </button>
            </Text>
        </Stack>
    );
}

function RegisterForm({ onBackToLogin }: { onBackToLogin: () => void }) {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const {
        mutate: register,
        isPending,
        error,
        isSuccess,
    } = useRegisterAccount();

    if (isSuccess) {
        return (
            <Notice tone="success">
                {t("auth.login.email.registerSuccess")}
            </Notice>
        );
    }

    return (
        <Stack space="s">
            <Input
                type="email"
                autoComplete="email"
                placeholder={t("auth.login.email.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            <Input
                type="password"
                autoComplete="new-password"
                placeholder={t("auth.login.email.newPasswordPlaceholder")}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
            <Text variant="caption" color="tertiary">
                {t("auth.login.email.passwordHint")}
            </Text>
            {error && <FieldError>{error.message}</FieldError>}
            <Button
                variant="primary"
                size="large"
                width="auto"
                loading={isPending}
                disabled={!email || password.length < 10 || isPending}
                onClick={() => register({ email, password })}
            >
                {t("auth.login.email.registerSubmit")}
            </Button>
            <Text variant="bodySmall" color="secondary">
                <button type="button" onClick={onBackToLogin}>
                    {t("auth.login.email.backToLogin")}
                </button>
            </Text>
        </Stack>
    );
}
