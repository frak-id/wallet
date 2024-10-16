"use client";

import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { CloudUpload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./index.module.css";

/**
 * Login from previous authentication
 * @constructor
 */
export function Login() {
    const { t } = useTranslation();
    const router = useRouter();
    const [, startTransition] = useTransition();
    const { login } = useLogin({
        onSuccess: () => {
            startTransition(() => {
                router.push("/wallet");
            });
        },
    });

    return (
        <>
            <Back href={"/register"}>{t("wallet.login.accountCreation")}</Back>
            <Grid
                className={styles.login__grid}
                footer={
                    <>
                        <Link href={"/recovery"} className={styles.login__link}>
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
