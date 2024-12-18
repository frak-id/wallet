import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { EcdsaLogin } from "@/module/authentication/component/EcdsaLogin";
import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { usePrivyCrossAppAuthenticate } from "@/module/common/hook/crossAppPrivyHooks";
import { useIsWebAuthNSupported } from "@/module/common/hook/useIsWebAuthNSupported";
import { CloudUpload } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import styles from "./login.module.css";

export default function Login() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const isWebAuthnSupported = useIsWebAuthNSupported();
    const { login } = useLogin({
        onSuccess: () => navigate("/wallet"),
    });
    const { mutateAsync: privyLogin } = usePrivyCrossAppAuthenticate({
        // On success, transmit the wallet address up a level
        onSuccess: () => navigate("/wallet"),
    });

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
                <ButtonAuth
                    trigger={() =>
                        isWebAuthnSupported ? login({}) : privyLogin()
                    }
                >
                    <Trans i18nKey={"wallet.login.button"} />
                </ButtonAuth>

                {isWebAuthnSupported && <EcdsaLogin />}
            </Grid>
        </>
    );
}
