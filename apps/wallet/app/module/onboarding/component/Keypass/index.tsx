import { Button } from "@frak-labs/ui/component/Button";
import { HandleErrors } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { StepLayout } from "@/module/common/component/StepLayout";

type KeypassProps = {
    onContinue: () => void;
    isLoading: boolean;
    error: Error | null;
    /** When true, shows "existing account" content with login button */
    existingAccount?: boolean;
    /** Loading state for the login action */
    isLoginLoading?: boolean;
    /** Error from the login attempt */
    loginError?: Error | null;
    /** Trigger login directly */
    onLogin?: () => void;
    /** Whether WebAuthn is supported in this browser */
    webAuthNSupported?: boolean;
    /** Navigate to login page (fallback when WebAuthn unsupported) */
    onNavigateToLogin?: () => void;
};

export function Keypass({
    onContinue,
    isLoading,
    error,
    existingAccount,
    isLoginLoading,
    loginError,
    onLogin,
    webAuthNSupported = true,
    onNavigateToLogin,
}: KeypassProps) {
    const { t } = useTranslation();

    if (!webAuthNSupported) {
        return (
            <StepLayout
                icon={<span>⚠️</span>}
                title={t("onboarding.keypass.unsupported.title")}
                description={t("onboarding.keypass.unsupported.description")}
                footer={
                    <Button
                        width={"full"}
                        size={"medium"}
                        onClick={onNavigateToLogin}
                    >
                        {t("onboarding.keypass.unsupported.button")}
                    </Button>
                }
            />
        );
    }

    if (existingAccount) {
        return (
            <StepLayout
                icon={<span>👋</span>}
                title={t("onboarding.keypass.existingAccount.title")}
                description={t(
                    "onboarding.keypass.existingAccount.description"
                )}
                footer={
                    <Button
                        width={"full"}
                        size={"medium"}
                        onClick={onLogin}
                        disabled={isLoginLoading}
                        isLoading={isLoginLoading}
                    >
                        {t("onboarding.keypass.existingAccount.button")}
                    </Button>
                }
            >
                {loginError && <HandleErrors error={loginError} />}
            </StepLayout>
        );
    }

    return (
        <StepLayout
            icon={<span>🔐</span>}
            title={t("onboarding.keypass.title")}
            description={t("onboarding.keypass.description")}
            footer={
                <>
                    <Button
                        width={"full"}
                        size={"medium"}
                        onClick={onContinue}
                        disabled={isLoading}
                        isLoading={isLoading}
                    >
                        {t("onboarding.continue")}
                    </Button>
                    <AuthenticateWithPhone
                        as={Button}
                        text={t("wallet.register.useQRCode")}
                        width={"full"}
                    />
                </>
            }
        >
            {error && <HandleErrors error={error} />}
        </StepLayout>
    );
}
