import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { Link, useNavigate } from "@remix-run/react";
import { CloudUpload } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./login.module.css";

export default function Login() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { login } = useLogin({
        onSuccess: () => {
            navigate("/wallet");
        },
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
                <ButtonAuth trigger={() => login({})}>
                    <Trans i18nKey={"wallet.login.button"} />
                </ButtonAuth>
            </Grid>
        </>
    );
}
