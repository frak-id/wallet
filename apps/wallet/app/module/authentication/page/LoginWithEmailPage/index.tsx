import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { HandleErrors, useLogin } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCheckEmail } from "@/module/authentication/hook/useCheckEmail";
import {
    EmailFormScreen,
    emailFormScreenStyles,
} from "@/module/common/component/EmailFormScreen";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";
import { modalStore } from "@/module/stores/modalStore";

/**
 * `/login/email` — sign-in flow that resolves an email to every passkey
 * currently bound to the wallet on the active chain and prompts the OS to
 * pick the right one via WebAuthn's `allowCredentials`.
 *
 * Three terminal states:
 *  - email matches a wallet with at least one active credential → run
 *    `useLogin({ allowedCredentialIds })`, then drain pending actions.
 *  - email is unknown OR matches a wallet without an active binding on
 *    the current chain (`authenticatorIds: []`) → open the
 *    `emailNotFound` modal which routes to `/register?new=1&email=…`.
 *  - email check fails (network / 422) → surface inline via the form
 *    so the user can retry without losing their input.
 */
export function LoginWithEmailPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loginError, setLoginError] = useState<Error | null>(null);

    const { executePendingActions } = useExecutePendingActions();

    const {
        checkEmail,
        isChecking,
        error: checkError,
        reset: resetCheck,
    } = useCheckEmail();

    const handlePostLoginRedirect = useCallback(async () => {
        const navigated = await executePendingActions();
        if (!navigated) {
            navigate({ to: "/wallet", replace: true });
        }
    }, [executePendingActions, navigate]);

    const { login, isLoading: isLoginLoading } = useLogin({
        onSuccess: handlePostLoginRedirect,
        onError: (err) => setLoginError(err),
    });

    const clearTransientState = useCallback(() => {
        if (checkError) resetCheck();
        if (loginError) setLoginError(null);
    }, [checkError, resetCheck, loginError]);

    const handleSubmit = useCallback(
        async (email: string) => {
            setLoginError(null);
            try {
                const result = await checkEmail(email);
                if (result.used && result.authenticatorIds.length > 0) {
                    await login({
                        allowedCredentialIds: result.authenticatorIds,
                    });
                    return;
                }
                modalStore.getState().openModal({
                    id: "emailNotFound",
                    email,
                });
            } catch {
                // `checkError` surfaces inline; user stays on the form
                // to retry the email.
            }
        },
        [checkEmail, login]
    );

    return (
        <EmailFormScreen
            title={t("wallet.login.email.title")}
            description={t("wallet.login.email.description")}
            label={t("onboarding.email.label")}
            placeholder={t("onboarding.email.placeholder")}
            clearAriaLabel={t("onboarding.email.clearAriaLabel")}
            submitLabel={t("wallet.login.email.submit")}
            onBack={() => navigate({ to: "/login", replace: true })}
            onSubmit={handleSubmit}
            isSubmitting={isChecking || isLoginLoading}
            onEmailChange={clearTransientState}
        >
            {checkError && (
                <Box role="alert" className={emailFormScreenStyles.inlineError}>
                    <Text variant="bodySmall" color="error">
                        {t("wallet.login.email.checkError")}
                    </Text>
                </Box>
            )}
            {loginError && (
                <Box role="alert" className={emailFormScreenStyles.inlineError}>
                    <HandleErrors error={loginError} />
                </Box>
            )}
        </EmailFormScreen>
    );
}
