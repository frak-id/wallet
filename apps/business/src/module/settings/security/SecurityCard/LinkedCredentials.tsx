import { Button } from "@frak-labs/design-system/components/Button";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLinkWallet } from "@/module/auth/hooks/useLinkWallet";
import { Input } from "@/module/forms/Input";
import { useLinkPassword } from "@/module/settings/security/useSecuritySettings";
import { useAuthStore } from "@/stores/authStore";

/**
 * Linked credentials overview (§5 deliverable 5): wallet / password /
 * Shopify. Only surfaces "add" actions for what's actually missing — the
 * account model only tells the client about its own `wallet`/`authMethod`,
 * not the full credential list, so a password-linked account that also
 * signed in via Shopify has no way to distinguish "has Shopify" from
 * "authenticated via Shopify this session" without a dedicated endpoint;
 * this keeps to what `authStore` actually knows.
 */
export function LinkedCredentials() {
    const { t } = useTranslation();
    const wallet = useAuthStore((state) => state.wallet);
    const authMethod = useAuthStore((state) => state.authMethod);
    const { mutate: linkWallet, isPending: isLinkingWallet } = useLinkWallet();

    return (
        <Stack space="s">
            <Text variant="body" weight="medium">
                {t("settings.security.credentials.title")}
            </Text>

            <Inline space="m" align="space-between" alignY="center">
                <Text variant="bodySmall" color="secondary">
                    {t("settings.security.credentials.wallet")}
                </Text>
                {wallet ? (
                    <Text variant="bodySmall">{wallet}</Text>
                ) : (
                    <Button
                        size="small"
                        variant="secondary"
                        width="auto"
                        loading={isLinkingWallet}
                        disabled={isLinkingWallet}
                        onClick={() => linkWallet()}
                    >
                        {t("settings.security.credentials.linkWallet")}
                    </Button>
                )}
            </Inline>

            {authMethod !== "password" && <AddPasswordForm />}
        </Stack>
    );
}

function AddPasswordForm() {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const {
        mutate: linkPassword,
        isPending,
        error,
        isSuccess,
    } = useLinkPassword();

    if (isSuccess) {
        return (
            <Text variant="bodySmall" color="success">
                {t("settings.security.credentials.passwordAdded")}
            </Text>
        );
    }

    return (
        <Stack space="xs">
            <Text variant="bodySmall" color="secondary">
                {t("settings.security.credentials.addPassword")}
            </Text>
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
            {error && <FieldError>{error.message}</FieldError>}
            <Button
                size="small"
                variant="secondary"
                width="auto"
                loading={isPending}
                disabled={!email || password.length < 10 || isPending}
                onClick={() => linkPassword({ email, password })}
            >
                {t("settings.security.credentials.savePassword")}
            </Button>
        </Stack>
    );
}
