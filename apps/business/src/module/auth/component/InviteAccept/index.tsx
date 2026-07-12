import { Button } from "@frak-labs/design-system/components/Button";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
    useInviteClaim,
    useInvitePreview,
} from "@/module/auth/hooks/useInvite";
import { AuthError } from "@/module/auth/utils/authError";
import { Input } from "@/module/forms/Input";
import {
    MIN_PASSWORD_LENGTH,
    PasswordInput,
} from "@/module/forms/PasswordInput";
import { useAuthStore } from "@/stores/authStore";

/**
 * Map the backend's typed error code to a translated message; falls back to
 * the raw (English) backend message for codes we don't special-case, same
 * pattern as `LinkedCredentials.tsx`'s `EMAIL_TAKEN` handling.
 */
function inviteErrorMessage(
    error: unknown,
    t: (key: "auth.invite.invalidToken") => string
): string | undefined {
    if (!(error instanceof Error)) return undefined;
    if (error instanceof AuthError && error.code === "INVALID_INVITATION") {
        return t("auth.invite.invalidToken");
    }
    return error.message;
}

/**
 * `/invite#token=…` landing page (merchant-team email invitation).
 * Public route: reads the token from the URL fragment (never the query
 * string, same convention as `/login/2fa#token=` and `/verify-email#code=`),
 * previews it for display context, then lets the invitee set a password to
 * claim the pre-created account. Claiming mints an already 2FA-verified
 * session directly — clicking the emailed link is itself the email-ownership
 * proof, so there is no `/login/2fa` detour here.
 */
export function InviteAccept({ token }: { token: string | undefined }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    // `isAuthenticated()` already implies a non-expired, non-pending token.
    const currentlyAuthenticated = useAuthStore((state) =>
        state.isAuthenticated()
    );

    const {
        data: previewData,
        isPending: isPreviewing,
        isError: previewFailed,
        error: previewError,
    } = useInvitePreview(token);

    if (!token) {
        return <InvalidInviteNotice />;
    }

    if (isPreviewing) {
        return (
            <Stack space="m" align="center">
                <Spinner />
            </Stack>
        );
    }

    if (previewFailed || !previewData) {
        return (
            <InvalidInviteNotice
                message={inviteErrorMessage(previewError, t)}
            />
        );
    }

    // A live session already exists in this browser — claiming would silently
    // switch the credential set, so require an explicit choice first. Checked
    // before `alreadyClaimed` so a signed-in invitee who re-opens their own
    // (already-claimed) link is offered the dashboard, not a sign-in prompt.
    if (currentlyAuthenticated) {
        return <AlreadyAuthenticatedNotice invitedEmail={previewData.email} />;
    }

    if (previewData.alreadyClaimed) {
        return (
            <Stack space="m" align="center">
                <Notice tone="info">
                    {t("auth.invite.alreadyClaimed", {
                        email: previewData.email,
                    })}
                </Notice>
                <Button
                    variant="primary"
                    width="auto"
                    onClick={() => navigate({ to: "/login" })}
                >
                    {t("auth.invite.goToLogin")}
                </Button>
            </Stack>
        );
    }

    return (
        <ClaimForm
            token={token}
            email={previewData.email}
            merchantName={previewData.merchantName}
            inviterName={previewData.inviterName}
        />
    );
}

function InvalidInviteNotice({ message }: { message?: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    return (
        <Stack space="m" align="center">
            <Notice tone="error" role="alert">
                {message ?? t("auth.invite.invalidToken")}
            </Notice>
            <Text variant="bodySmall" color="secondary">
                {t("auth.invite.askToResend")}
            </Text>
            <Button
                variant="secondary"
                width="auto"
                onClick={() => navigate({ to: "/login" })}
            >
                {t("auth.invite.goToLogin")}
            </Button>
        </Stack>
    );
}

// The "different account" copy below is a safe assumption, not a guess: an
// unclaimed invitation's account is credential-less by construction, so no
// session can exist for it yet — any live session in this browser is
// necessarily some *other* account. (Only holds pre-claim; once claimed the
// `alreadyClaimed` branch above takes over instead.)
function AlreadyAuthenticatedNotice({
    invitedEmail,
}: {
    invitedEmail: string;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <Stack space="m" align="center">
            <Notice tone="info">
                {t("auth.invite.alreadyAuthenticated", {
                    email: invitedEmail,
                })}
            </Notice>
            <Button
                variant="primary"
                width="auto"
                onClick={() => navigate({ to: "/dashboard" })}
            >
                {t("auth.invite.openDashboard")}
            </Button>
            <Button
                variant="ghost"
                size="small"
                width="auto"
                onClick={() => {
                    useAuthStore.getState().clearAuth();
                }}
            >
                {t("auth.invite.signOutFirst")}
            </Button>
        </Stack>
    );
}

function ClaimForm({
    token,
    email,
    merchantName,
    inviterName,
}: {
    token: string;
    email: string;
    merchantName: string;
    inviterName: string;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const { mutate: claim, isPending, error } = useInviteClaim();

    const onSubmit = () => {
        claim(
            { token, password, displayName: displayName.trim() || undefined },
            {
                onSuccess: (data) => {
                    if (data.hasMerchantAccess) {
                        navigate({
                            to: "/m/$merchantId/dashboard",
                            params: { merchantId: data.merchantId },
                        });
                    } else {
                        navigate({ to: "/dashboard" });
                    }
                },
            }
        );
    };
    const claimErrorMessage = inviteErrorMessage(error, t);

    return (
        <Stack space="m">
            <Stack space="xs">
                <Text as="h1" variant="heading1">
                    <Trans
                        i18nKey="auth.invite.title"
                        values={{ merchantName }}
                        components={{ strong: <strong /> }}
                    />
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {t("auth.invite.subtitle", { inviterName })}
                </Text>
            </Stack>

            <Stack space="s">
                <Input
                    variant="bare"
                    tone="muted"
                    type="email"
                    label={t("auth.login.email.emailPlaceholder")}
                    value={email}
                    readOnly
                    disabled
                />
                <Input
                    variant="bare"
                    tone="muted"
                    autoFocus
                    type="text"
                    autoComplete="name"
                    label={t("auth.invite.displayNamePlaceholder")}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                />
                <PasswordInput
                    variant="bare"
                    tone="muted"
                    autoComplete="new-password"
                    label={t("auth.login.email.newPasswordPlaceholder")}
                    hint={
                        claimErrorMessage ?? t("auth.login.email.passwordHint")
                    }
                    error={Boolean(error)}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                />
                <Button
                    variant="primary"
                    size="large"
                    width="full"
                    loading={isPending}
                    disabled={
                        password.length < MIN_PASSWORD_LENGTH || isPending
                    }
                    onClick={onSubmit}
                >
                    {t("auth.invite.submit")}
                </Button>
            </Stack>
        </Stack>
    );
}
