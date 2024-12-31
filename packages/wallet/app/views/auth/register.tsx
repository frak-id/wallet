import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { EcdsaLogin } from "@/module/authentication/component/EcdsaLogin";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { usePrivyCrossAppAuthenticate } from "@/module/common/hook/privy/crossAppPrivyHooks";
import { useIsWebAuthNSupported } from "@/module/common/hook/useIsWebAuthNSupported";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import styles from "./register.module.css";

export default function Register() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [disabled, setDisabled] = useState(false);
    const isWebAuthnSupported = useIsWebAuthNSupported();
    const { register, error, isRegisterInProgress } = useRegister({
        onSuccess: () => navigate("/wallet"),
    });
    const { mutateAsync: privyLogin } = usePrivyCrossAppAuthenticate({
        // On success, transmit the wallet address up a level
        onSuccess: () => navigate("/wallet"),
    });

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
            navigate("/login");
        }, 3000);
    }, [isPreviouslyUsedAuthenticatorError, navigate]);

    return (
        <Grid
            className={styles.register__grid}
            footer={
                <>
                    <Link to={"/login"} viewTransition>
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
                trigger={isWebAuthnSupported ? register : privyLogin}
                disabled={disabled || isPreviouslyUsedAuthenticatorError}
            >
                {message}
            </ButtonAuth>
            {isWebAuthnSupported && <EcdsaLogin />}
        </Grid>
    );
}
