import { Button } from "@frak-labs/ui/component/Button";
import {
    Drawer,
    DrawerContent,
    DrawerTitle,
    HandleErrors,
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

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            dismissible={false}
            shouldScaleBackground={false}
            modal={true}
        >
            <DrawerContent hideHandle={true}>
                {!webAuthNSupported ? (
                    <div className={styles.keypass}>
                        <DrawerTitle className="sr-only">
                            {t("onboarding.keypass.unsupported.title")}
                        </DrawerTitle>
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
                    </div>
                ) : existingAccount ? (
                    <div className={styles.keypass}>
                        <DrawerTitle className="sr-only">
                            {t("onboarding.keypass.existingAccount.title")}
                        </DrawerTitle>
                        <div className={styles.keypass__icon}>
                            <span>👋</span>
                        </div>
                        <h2 className={styles.keypass__title}>
                            {t("onboarding.keypass.existingAccount.title")}
                        </h2>
                        <p className={styles.keypass__description}>
                            {t(
                                "onboarding.keypass.existingAccount.description"
                            )}
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
                    </div>
                ) : (
                    <div className={styles.keypass}>
                        <DrawerTitle className="sr-only">
                            {t("onboarding.keypass.title")}
                        </DrawerTitle>
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
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    );
}
