import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { VerifyEmail } from "@/module/auth/component/VerifyEmail";
import { useLinkWallet } from "@/module/auth/hooks/useLinkWallet";
import { AuthError } from "@/module/auth/utils/authError";
import { DetailRow } from "@/module/common/component/DetailRow";
import { WalletAddress } from "@/module/common/component/HashDisplay";
import { Input } from "@/module/forms/Input";
import {
    MIN_PASSWORD_LENGTH,
    PasswordInput,
} from "@/module/forms/PasswordInput";
import {
    useAccountCredentials,
    useLinkPassword,
} from "@/module/settings/security/useSecuritySettings";

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
    const { data: account } = useAccountCredentials();
    const {
        mutate: linkWallet,
        isPending: isLinkingWallet,
        error: linkWalletError,
    } = useLinkWallet();
    const [addingPassword, setAddingPassword] = useState(false);

    const wallet = account?.wallet ?? null;
    const hasPassword = !!account?.hasPassword;
    const emailPending = hasPassword && !account?.emailVerified;

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
                {hasPassword ? (
                    <Inline space="xs" alignY="center">
                        {account?.email && (
                            <Text variant="bodySmall" color="secondary">
                                {account.email}
                            </Text>
                        )}
                        <Badge variant={emailPending ? "warning" : "success"}>
                            {t(
                                emailPending
                                    ? "settings.security.credentials.pending"
                                    : "settings.security.credentials.connected"
                            )}
                        </Badge>
                    </Inline>
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

            {!hasPassword && addingPassword && <AddPasswordForm />}

            {/* Email attached but unverified — always surface the verify form
                (explicit send → enter code), no toggle. Disappears once the
                account query refetches as verified. */}
            {emailPending && (
                <Stack space="s">
                    <Text variant="bodySmall" color="secondary">
                        {t("settings.security.credentials.verifyEmailHint")}
                    </Text>
                    <VerifyEmail embedded />
                </Stack>
            )}
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

    // On success the account query is invalidated → the row flips to the
    // pending state and the parent renders the (single) verify form. Nothing
    // to show here anymore.
    if (isSuccess) return null;

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
            <PasswordInput
                variant="bare"
                tone="muted"
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
                disabled={
                    !email || password.length < MIN_PASSWORD_LENGTH || isPending
                }
                onClick={() => linkPassword({ email, password })}
            >
                {t("settings.security.credentials.savePassword")}
            </Button>
        </Stack>
    );
}
