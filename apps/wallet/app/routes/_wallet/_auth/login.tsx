import { Button } from "@frak-labs/ui/component/Button";
import { HandleErrors, sessionStore } from "@frak-labs/wallet-shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AuthActions } from "@/module/authentication/component/AuthActions";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { LoginList } from "@/module/authentication/component/LoginList";
import { StepLayout } from "@/module/common/component/StepLayout";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { usePendingPairingInfo } from "@/module/pairing/hook/usePendingPairingInfo";
import { consumePendingDeepLink } from "@/utils/deepLink";

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
    const { pairingInfo } = usePendingPairingInfo();
    const hasPendingPairing = Boolean(pairingInfo?.id);
    const [error, setError] = useState<Error | null>(null);
    const session = sessionStore((state) => state.session);
    const hasHandledPostLoginRedirect = useRef(false);

    const handlePostLoginRedirect = useCallback(() => {
        if (hasHandledPostLoginRedirect.current) return;
        hasHandledPostLoginRedirect.current = true;

        if (consumePendingDeepLink(navigate)) return;
        navigate({
            to: hasPendingPairing ? "/pairing" : "/wallet",
            replace: true,
        });
    }, [navigate, hasPendingPairing]);

    // Redirect after successful login: pending deep link > pairing > wallet
    useEffect(() => {
        if (!session) return;
        handlePostLoginRedirect();
    }, [session, handlePostLoginRedirect]);

    const handleLoginSuccess = () => {
        handlePostLoginRedirect();
    };

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
                            onSuccess={handleLoginSuccess}
                            onError={setError}
                            loginButtonText={t("wallet.login.button")}
                        />
                        <AuthenticateWithPhone
                            as={Button}
                            text={t("wallet.login.useQRCode")}
                            width={"full"}
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
                {error && <HandleErrors error={error} />}
            </StepLayout>
        </>
    );
}
