import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { isWebAuthNSupported } from "@/module/common/lib/webauthn";
import { AuthenticateWithPhone } from "@/module/listener/modal/component/AuthenticateWithPhone";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { Button } from "@frak-labs/ui/component/Button";
import { CloudUpload } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";
import styles from "./login.module.css";

export default function Login() {
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
                    trigger={() => login({})}
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
