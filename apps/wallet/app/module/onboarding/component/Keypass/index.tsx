import { Box } from "@frak-labs/ui/component/Box";
import { Button } from "@frak-labs/ui/component/Button";
import { useMediaQuery } from "@frak-labs/ui/hook/useMediaQuery";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
    HandleErrors,
    WalletModal,
} from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import styles from "./index.module.css";

type KeypassProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
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
    open,
    onOpenChange,
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
    const isDesktop = useMediaQuery("(min-width: 600px)");

    const content = (
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
    );

    if (isDesktop) {
        return (
            <WalletModal
                text={content}
                open={open}
                onOpenChange={onOpenChange}
            />
        );
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            shouldScaleBackground={false}
            modal={true}
        >
            <DrawerContent hideHandle={true}>
                <DrawerTitle className="sr-only">
                    {t("onboarding.keypass.title")}
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                    {t("onboarding.keypass.description")}
                </DrawerDescription>
                {content}
            </DrawerContent>
        </Drawer>
    );
}

/**
 * Shared content for all Keypass variants, rendered inside either Drawer (mobile) or WalletModal (desktop)
 */
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
}: Omit<KeypassProps, "open" | "onOpenChange">) {
    const { t } = useTranslation();

    if (!webAuthNSupported) {
        return (
            <Box gap="l" padding="none" className={styles.keypass}>
                <div className={styles.keypass__icon}>
                    <span>⚠️</span>
                </div>
                <h2 className={styles.keypass__title}>
                    {t("onboarding.keypass.unsupported.title")}
                </h2>
                <p className={styles.keypass__description}>
                    {t("onboarding.keypass.unsupported.description")}
                </p>
                <div className={styles.keypass__footer}>
                    <Button
                        width={"full"}
                        size={"medium"}
                        onClick={onNavigateToLogin}
                    >
                        {t("onboarding.keypass.unsupported.button")}
                    </Button>
                </div>
            </Box>
        );
    }

    if (existingAccount) {
        return (
            <Box gap="l" padding="none" className={styles.keypass}>
                <div className={styles.keypass__icon}>
                    <span>👋</span>
                </div>
                <h2 className={styles.keypass__title}>
                    {t("onboarding.keypass.existingAccount.title")}
                </h2>
                <p className={styles.keypass__description}>
                    {t("onboarding.keypass.existingAccount.description")}
                </p>
                {loginError && <HandleErrors error={loginError} />}
                <div className={styles.keypass__footer}>
                    <Button
                        width={"full"}
                        size={"medium"}
                        onClick={onLogin}
                        disabled={isLoginLoading}
                        isLoading={isLoginLoading}
                    >
                        {t("onboarding.keypass.existingAccount.button")}
                    </Button>
                </div>
            </Box>
        );
    }

    return (
        <Box gap="l" padding="none" className={styles.keypass}>
            <div className={styles.keypass__icon}>
                <span>🔐</span>
            </div>
            <h2 className={styles.keypass__title}>
                {t("onboarding.keypass.title")}
            </h2>
            <p className={styles.keypass__description}>
                {t("onboarding.keypass.description")}
            </p>
            {error && <HandleErrors error={error} />}
            <div className={styles.keypass__footer}>
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
            </div>
        </Box>
    );
}
