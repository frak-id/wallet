import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLinkWallet } from "@/module/auth/hooks/useLinkWallet";
import { AuthError } from "@/module/auth/utils/authError";
import { DetailRow } from "@/module/common/component/DetailRow";
import { WalletAddress } from "@/module/common/component/HashDisplay";
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
    const {
        mutate: linkWallet,
        isPending: isLinkingWallet,
        error: linkWalletError,
    } = useLinkWallet();
    const [addingPassword, setAddingPassword] = useState(false);

    return (
        <Stack space="s">
            <Text variant="body" weight="medium">
                {t("settings.security.credentials.title")}
            </Text>

            <DetailRow label={t("settings.security.credentials.wallet")}>
                {wallet ? (
                    <WalletAddress
                        wallet={wallet}
                        copiedText={t("common.copied")}
                    />
                ) : (
                    <Button
                        size="small"
                        variant="ghost"
                        width="auto"
                        loading={isLinkingWallet}
                        disabled={isLinkingWallet}
                        onClick={() => linkWallet()}
                    >
                        {t("settings.security.credentials.linkWallet")}
                    </Button>
                )}
            </DetailRow>
            {linkWalletError && (
                <Notice tone="error">{linkWalletError.message}</Notice>
            )}

            <DetailRow label={t("settings.security.credentials.password")}>
                {authMethod === "password" ? (
                    <Badge variant="success">
                        {t("settings.security.credentials.connected")}
                    </Badge>
                ) : (
                    <Button
                        size="small"
                        variant="ghost"
                        width="auto"
                        onClick={() => setAddingPassword((open) => !open)}
                    >
                        {t("settings.security.credentials.addPasswordCta")}
                    </Button>
                )}
            </DetailRow>

            {authMethod !== "password" && addingPassword && <AddPasswordForm />}
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

    // Map the typed EMAIL_TAKEN conflict to a translated message; fall back
    // to the backend message for anything else (§2.1).
    const errorMessage = error
        ? error instanceof AuthError && error.code === "EMAIL_TAKEN"
            ? t("settings.security.credentials.emailTaken")
            : error.message
        : null;

    if (isSuccess) {
        return (
            <Notice tone="success">
                {t("settings.security.credentials.passwordAdded")}
            </Notice>
        );
    }

    return (
        <Stack space="xs">
            <Text variant="bodySmall" color="secondary">
                {t("settings.security.credentials.addPassword")}
            </Text>
            <Input
                variant="bare"
                tone="muted"
                type="email"
                autoComplete="email"
                label={t("auth.login.email.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            <Input
                variant="bare"
                tone="muted"
                type="password"
                autoComplete="new-password"
                label={t("auth.login.email.newPasswordPlaceholder")}
                hint={errorMessage ?? t("auth.login.email.passwordHint")}
                error={Boolean(errorMessage)}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />
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
