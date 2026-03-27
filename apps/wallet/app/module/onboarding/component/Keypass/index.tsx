import { tablet } from "@frak-labs/design-system/breakpoints";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from "@frak-labs/design-system/components/Drawer";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import { visuallyHidden } from "@frak-labs/design-system/utils";
import { HandleErrors, WalletModal } from "@frak-labs/wallet-shared";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import * as styles from "./index.css";

/**
 * Inline media query hook — only used in Keypass, avoids legacy UI package dependency.
 */
function useMediaQuery(query: string) {
    const mediaQueryList = useMemo(() => {
        if (typeof window !== "undefined") {
            return window.matchMedia(query);
        }
        return null;
    }, [query]);

    const [matches, setMatches] = useState(() =>
        mediaQueryList ? mediaQueryList.matches : false
    );

    useEffect(() => {
        if (!mediaQueryList) return;

        const handleChange = () => setMatches(mediaQueryList.matches);
        mediaQueryList.addEventListener("change", handleChange);
        return () => mediaQueryList.removeEventListener("change", handleChange);
    }, [mediaQueryList]);

    return matches;
}

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
    const isDesktop = useMediaQuery(`(min-width: ${tablet}px)`);

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
            <DrawerContent
                hideHandle={true}
                contentClassName={styles.drawerContent}
            >
                <DrawerTitle className={visuallyHidden}>
                    {t("onboarding.keypass.title")}
                </DrawerTitle>
                <DrawerDescription className={visuallyHidden}>
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
}: Omit<KeypassProps, "open" | "onOpenChange">) {
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
                    <Button onClick={onLogin} disabled={isLoginLoading}>
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
                    <Button onClick={onContinue} disabled={isLoading}>
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
