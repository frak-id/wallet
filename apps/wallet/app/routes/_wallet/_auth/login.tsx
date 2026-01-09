import { Button } from "@frak-labs/ui/component/Button";
import { HandleErrors, sessionStore } from "@frak-labs/wallet-shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CloudUpload } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthActions } from "@/module/authentication/component/AuthActions";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { LoginList } from "@/module/authentication/component/LoginList";
import styles from "@/module/authentication/page/LoginPage.module.css";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";

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

    // Redirect to wallet after successful login
    useEffect(() => {
        if (session) {
            navigate({ to: "/wallet", replace: true });
        }
    }, [session, navigate]);

    const handleLoginSuccess = () => {
        navigate({ to: "/wallet", replace: true });
    };

    return (
        <>
            <Back href={"/register"}>{t("wallet.login.accountCreation")}</Back>
            <Grid
                className={styles.login__grid}
                footer={
                    <>
                        <Link
                            to={"/recovery"}
                            className={styles.login__link}
                            viewTransition
                        >
                            <CloudUpload /> {t("wallet.login.recover")}
                        </Link>
                        <LoginList />
                    </>
                }
            >
                <PairingInProgress />

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

                {error && <HandleErrors error={error} />}
            </Grid>
        </>
    );
}
