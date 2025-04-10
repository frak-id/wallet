import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { useIsWebAuthNSupported } from "@/module/common/hook/useIsWebAuthNSupported";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { CloudUpload } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";
import styles from "./login.module.css";

export default function Login() {
    const { t } = useTranslation();
    const isWebAuthnSupported = useIsWebAuthNSupported();
    const { login } = useLogin({});

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
                    disabled={!isWebAuthnSupported}
                    trigger={() => login({})}
                >
                    <Trans i18nKey={"wallet.login.button"} />
                </ButtonAuth>
            </Grid>
        </>
    );
}
