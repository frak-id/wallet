import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import { HandleErrors } from "@frak-labs/wallet-shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import type { KeypassProps } from "@/module/stores/modalStore";
import * as styles from "./index.css";

type KeypassModalProps = KeypassProps & {
    onClose: () => void;
};

export function Keypass({
    onClose,
    onContinue,
    isLoading,
    error,
    existingAccount,
    isLoginLoading,
    loginError,
    onLogin,
    webAuthNSupported = true,
    onNavigateToLogin,
}: KeypassModalProps) {
    const { t } = useTranslation();

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
                onContinue={onContinue}
                isLoading={isLoading}
                error={error}
                existingAccount={existingAccount}
                isLoginLoading={isLoginLoading}
                loginError={loginError}
                onLogin={onLogin}
                webAuthNSupported={webAuthNSupported}
                onNavigateToLogin={onNavigateToLogin}
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

function KeypassContent({
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
            error={error}
            footer={
                <>
                    <Button onClick={onContinue} loading={isLoading}>
                        {t("onboarding.continue")}
                    </Button>
                    <AuthenticateWithPhone
                        text={t("wallet.register.useQRCode")}
                    />
                </>
            }
        />
    );
}
