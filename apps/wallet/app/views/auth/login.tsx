import { Button } from "@frak-labs/ui/component/Button";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { isWebAuthNSupported } from "@frak-labs/wallet-shared/common/lib/webauthn";
import { CloudUpload } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
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
