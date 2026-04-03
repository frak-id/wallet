import { HandleErrors, sessionStore } from "@frak-labs/wallet-shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AuthActions } from "@/module/authentication/component/AuthActions";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { LoginList } from "@/module/authentication/component/LoginList";
import { StepLayout } from "@/module/common/component/StepLayout";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";
import * as styles from "./login.css";

export const Route = createFileRoute("/_wallet/_auth/login")({
    component: LoginPage,
});

/**
 * LoginPage
 *
 * Authentication page that allows users to log in using:
 * - WebAuthn passkeys
 * - Phone authentication via QR code
 * - Recovery options
 *
 * @returns {JSX.Element} The rendered login page
 */
function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [error, setError] = useState<Error | null>(null);
    const session = sessionStore((state) => state.session);
    const { executePendingActions } = useExecutePendingActions();

    const handlePostLoginRedirect = useCallback(async () => {
        const navigated = await executePendingActions();
        if (!navigated) {
            navigate({ to: "/wallet", replace: true });
        }
    }, [executePendingActions, navigate]);

    // Redirect after successful login: pending deep link > pairing > wallet
    // Catches QR/phone auth where session appears without a direct callback
    useEffect(() => {
        if (!session) return;
        handlePostLoginRedirect();
    }, [session, handlePostLoginRedirect]);

    return (
        <>
            <DemoTapZone navigate={navigate} />
            <PairingInProgress />
            <StepLayout
                icon={<span>🔐</span>}
                title={t("wallet.welcome.title")}
                description={<Trans i18nKey={"wallet.login.button"} />}
                footer={
                    <>
                        <AuthActions
                            onSuccess={handlePostLoginRedirect}
                            onError={setError}
                            loginButtonText={t("wallet.login.button")}
                        />
                        <AuthenticateWithPhone
                            text={t("wallet.login.useQRCode")}
                            onSuccess={handlePostLoginRedirect}
                        />
                        <Link to={"/recovery"} viewTransition>
                            {t("wallet.login.recover")}
                        </Link>
                        <Link to={"/register"} search={{ new: true }}>
                            {t("wallet.login.accountCreation")}
                        </Link>
                        <LoginList />
                    </>
                }
            >
                {error && (
                    <HandleErrors error={error} className={styles.errorText} />
                )}
            </StepLayout>
        </>
    );
}
