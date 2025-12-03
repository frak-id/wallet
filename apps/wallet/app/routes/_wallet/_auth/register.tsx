import { Button } from "@frak-labs/ui/component/Button";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { isWebAuthNSupported } from "@frak-labs/wallet-shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { useRegister } from "@/module/authentication/hook/useRegister";
import styles from "@/module/authentication/page/RegisterPage.module.css";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";

export const Route = createFileRoute("/_wallet/_auth/register")({
    component: RegisterPage,
});

/**
 * RegisterPage
 *
 * Registration page that allows users to create a new wallet using:
 * - WebAuthn passkeys
 * - Phone authentication via QR code
 *
 * @returns {JSX.Element} The rendered registration page
 */
function RegisterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [disabled, setDisabled] = useState(false);
    const { register, error, isRegisterInProgress, isSuccess } = useRegister(
        {}
    );

    // Debug logging on mount
    useEffect(() => {
        console.log("[RegisterPage] Component mounted");
        console.log("[RegisterPage] isWebAuthNSupported:", isWebAuthNSupported);
        console.log(
            "[RegisterPage] window.PublicKeyCredential:",
            typeof window !== "undefined"
                ? window.PublicKeyCredential
                : "undefined"
        );
    }, []);

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
            navigate({ to: "/login" });
        }, 3000);
    }, [isPreviouslyUsedAuthenticatorError, navigate]);

    // Redirect to wallet after successful registration
    useEffect(() => {
        if (isSuccess) {
            navigate({ to: "/wallet", replace: true });
        }
    }, [isSuccess, navigate]);

    // Debug button state
    const isButtonDisabled =
        disabled || isPreviouslyUsedAuthenticatorError || !isWebAuthNSupported;
    useEffect(() => {
        console.log("[RegisterPage] Button state:", {
            disabled,
            isPreviouslyUsedAuthenticatorError,
            isWebAuthNSupported,
            isButtonDisabled,
            isRegisterInProgress,
        });
    }, [disabled, isPreviouslyUsedAuthenticatorError, isRegisterInProgress]);

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
            <PairingInProgress />
            <ButtonAuth
                onClick={(e) => {
                    console.log("[Register] ===== BUTTON CLICKED =====");
                    console.log("[Register] Event:", e);
                    console.log(
                        "[Register] isWebAuthNSupported:",
                        isWebAuthNSupported
                    );
                    console.log(
                        "[Register] Button disabled state:",
                        disabled ||
                            isPreviouslyUsedAuthenticatorError ||
                            !isWebAuthNSupported
                    );
                    console.log("[Register] Calling register...");
                    try {
                        register();
                        console.log(
                            "[Register] register() called successfully"
                        );
                    } catch (err) {
                        console.error(
                            "[Register] Error calling register():",
                            err
                        );
                    }
                }}
                disabled={
                    disabled ||
                    isPreviouslyUsedAuthenticatorError ||
                    !isWebAuthNSupported
                }
                isLoading={isRegisterInProgress}
            >
                {message}
            </ButtonAuth>
            <AuthenticateWithPhone
                as={Button}
                text={t("wallet.register.useQRCode")}
                width={"full"}
            />
        </Grid>
    );
}
