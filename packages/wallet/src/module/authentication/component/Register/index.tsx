"use client";

import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function Register() {
    const { t } = useTranslation();
    const router = useRouter();
    const { register, error, isRegisterInProgress } = useRegister({
        onSuccess: () => {
            router.push("/wallet");
        },
    });
    const [disabled, setDisabled] = useState(false);

    /**
     * Boolean used to know if the error is about a previously used authenticator
     */
    const isPreviouslyUsedAuthenticatorError = useMemo(
        () =>
            !!error &&
            "code" in error &&
            error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
        [error]
    );

    /**
     * Get the message that will displayed inside the button
     */
    const message = useMemo(() => {
        if (isPreviouslyUsedAuthenticatorError) {
            return (
                <Trans i18nKey={"wallet.register.button.alreadyRegistered"} />
            );
        }
        if (error) {
            return t("wallet.register.button.error");
        }
        if (isRegisterInProgress) {
            return <Trans i18nKey={"wallet.register.button.inProgress"} />;
        }
        return (
            <Trans
                i18nKey={"wallet.register.button.create"}
                components={{
                    sup: <sup />,
                }}
            />
        );
    }, [isPreviouslyUsedAuthenticatorError, error, isRegisterInProgress, t]);

    useEffect(() => {
        if (!error) return;

        setDisabled(false);
    }, [error]);

    useEffect(() => {
        if (!isPreviouslyUsedAuthenticatorError) return;

        setTimeout(() => {
            router.push("/login");
        }, 3000);
    }, [isPreviouslyUsedAuthenticatorError, router]);

    return (
        <Grid
            className={styles.register__grid}
            footer={
                <>
                    <Link href={"/login"}>
                        {t("wallet.register.useExisting")}
                    </Link>
                    <Notice>
                        <Trans
                            i18nKey={"wallet.register.notice"}
                            components={{
                                sup: <sup />,
                            }}
                        />
                    </Notice>
                </>
            }
        >
            <ButtonAuth
                trigger={register}
                disabled={disabled || isPreviouslyUsedAuthenticatorError}
            >
                {message}
            </ButtonAuth>
        </Grid>
    );
}
