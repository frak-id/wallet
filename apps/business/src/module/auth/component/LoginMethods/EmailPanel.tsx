import { Button } from "@frak-labs/design-system/components/Button";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    usePasswordLogin,
    useRegisterAccount,
} from "@/module/auth/hooks/useEmailAuth";
import { Input } from "@/module/forms/Input";

export function EmailPanel() {
    const [mode, setMode] = useState<"login" | "register">("login");

    if (mode === "register") {
        return <RegisterForm onBackToLogin={() => setMode("login")} />;
    }
    return <LoginForm onRegister={() => setMode("register")} />;
}

function LoginForm({ onRegister }: { onRegister: () => void }) {
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
                    navigate({ to: "/login/2fa" });
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
                {t("auth.login.email.noAccount")}{" "}
                <button type="button" onClick={onRegister}>
                    {t("auth.login.email.registerCta")}
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
