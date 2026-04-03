import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import {
    HandleErrors,
    isWebAuthNSupported,
    useLogin,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { isAuthenticatorAlreadyRegistered } from "@/module/authentication/lib/isAuthenticatorAlreadyRegistered";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import * as styles from "./index.css";

type KeypassProps = {
    onClose: () => void;
    onAuthSuccess: () => void;
};

export function Keypass({ onClose, onAuthSuccess }: KeypassProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isRegistering, setIsRegistering] = useState(false);

    const { register, error: registerError } = useRegister({});
    const {
        login,
        isLoading: isLoginLoading,
        error: loginError,
    } = useLogin({ onSuccess: onAuthSuccess });

    const existingAccount = useMemo(
        () =>
            !!registerError && isAuthenticatorAlreadyRegistered(registerError),
        [registerError]
    );

    const handleRegister = () => {
        if (isRegistering) return;
        setIsRegistering(true);
        register()
            .then(() => onAuthSuccess())
            .catch(() => setIsRegistering(false));
    };

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={t("onboarding.keypass.title")}
            description={t("onboarding.keypass.description")}
        >
            <KeypassContent
                onRegister={handleRegister}
                isRegistering={isRegistering}
                registerError={existingAccount ? null : registerError}
                existingAccount={existingAccount}
                isLoginLoading={isLoginLoading}
                loginError={loginError}
                onLogin={() => login()}
                onAuthSuccess={onAuthSuccess}
                onNavigateToLogin={() =>
                    navigate({ to: "/login", replace: true })
                }
            />
        </ResponsiveModal>
    );
}

/**
 * Shared content for all Keypass variants
 */
function KeypassBlock({
    title,
    description,
    footer,
    error,
}: {
    title: string;
    description: string;
    footer: ReactNode;
    error?: Error | null;
}) {
    return (
        <Box className={styles.keypass}>
            <ContentBlock
                icon={<FaceIdIcon />}
                titleAs="h1"
                title={title}
                description={description}
                textSpacing="m"
                footer={footer}
            >
                {error && (
                    <HandleErrors error={error} className={styles.errorText} />
                )}
            </ContentBlock>
        </Box>
    );
}

type KeypassContentProps = {
    onRegister: () => void;
    isRegistering: boolean;
    registerError: Error | null;
    existingAccount: boolean;
    isLoginLoading: boolean;
    loginError: Error | null;
    onLogin: () => void;
    onAuthSuccess: () => void;
    onNavigateToLogin: () => void;
};

function KeypassContent({
    onRegister,
    isRegistering,
    registerError,
    existingAccount,
    isLoginLoading,
    loginError,
    onLogin,
    onAuthSuccess,
    onNavigateToLogin,
}: KeypassContentProps) {
    const { t } = useTranslation();

    if (!isWebAuthNSupported) {
        return (
            <KeypassBlock
                title={t("onboarding.keypass.unsupported.title")}
                description={t("onboarding.keypass.unsupported.description")}
                footer={
                    <Button onClick={onNavigateToLogin}>
                        {t("onboarding.keypass.unsupported.button")}
                    </Button>
                }
            />
        );
    }

    if (existingAccount) {
        return (
            <KeypassBlock
                title={t("onboarding.keypass.existingAccount.title")}
                description={t(
                    "onboarding.keypass.existingAccount.description"
                )}
                error={loginError}
                footer={
                    <Button onClick={onLogin} loading={isLoginLoading}>
                        {t("onboarding.keypass.existingAccount.button")}
                    </Button>
                }
            />
        );
    }

    return (
        <KeypassBlock
            title={t("onboarding.keypass.title")}
            description={t("onboarding.keypass.description")}
            error={registerError}
            footer={
                <>
                    <Button onClick={onRegister} loading={isRegistering}>
                        {t("onboarding.continue")}
                    </Button>
                    <AuthenticateWithPhone
                        text={t("wallet.register.useQRCode")}
                        onSuccess={onAuthSuccess}
                    />
                </>
            }
        />
    );
}
