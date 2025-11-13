import { Button } from "@frak-labs/ui/component/Button";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { isWebAuthNSupported, useLogin } from "@frak-labs/wallet-shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CloudUpload } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { LoginList } from "@/module/authentication/component/LoginList";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import styles from "./login.module.css";

export const Route = createFileRoute("/_wallet/_auth/login")({
    component: Login,
});

function Login() {
    const { t } = useTranslation();
    const { login, isLoading } = useLogin({});

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
