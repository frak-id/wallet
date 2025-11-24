import { Button } from "@frak-labs/ui/component/Button";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { isWebAuthNSupported, useLogin } from "@frak-labs/wallet-shared";
import { Link, useNavigate } from "@tanstack/react-router";
import { CloudUpload } from "lucide-react";
import { useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { LoginList } from "@/module/authentication/component/LoginList";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import styles from "./LoginPage.module.css";

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
export function LoginPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { login, isLoading, isSuccess } = useLogin({});

    // Redirect to wallet after successful login
    useEffect(() => {
        if (isSuccess) {
            navigate({ to: "/wallet", replace: true });
        }
    }, [isSuccess, navigate]);

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
                <ButtonAuth
                    disabled={!isWebAuthNSupported || isLoading}
                    isLoading={isLoading}
                    onClick={() => login({})}
                >
                    <Trans i18nKey={"wallet.login.button"} />
                </ButtonAuth>
                <AuthenticateWithPhone
                    as={Button}
                    text={t("wallet.login.useQRCode")}
                    width={"full"}
                />
            </Grid>
        </>
    );
}
