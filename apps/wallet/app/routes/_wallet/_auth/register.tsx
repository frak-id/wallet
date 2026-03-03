import { Button } from "@frak-labs/ui/component/Button";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import {
    authenticatorStorage,
    isWebAuthNSupported,
} from "@frak-labs/wallet-shared";
import {
    createFileRoute,
    Link,
    redirect,
    useNavigate,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AuthenticateWithPhone } from "@/module/authentication/component/AuthenticateWithPhone";
import { DemoTapZone } from "@/module/authentication/component/DemoTapZone";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { isAuthenticatorAlreadyRegistered } from "@/module/authentication/lib/isAuthenticatorAlreadyRegistered";
import styles from "@/module/authentication/page/RegisterPage.module.css";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { PairingInProgress } from "@/module/pairing/component/PairingInProgress";
import { usePendingPairingInfo } from "@/module/pairing/hook/usePendingPairingInfo";
import { consumePendingDeepLink } from "@/utils/deepLink";

export const Route = createFileRoute("/_wallet/_auth/register")({
    component: RegisterPage,
    beforeLoad: async ({ location }) => {
        // Skip redirect if user explicitly requested new account creation
        const search = new URLSearchParams(location.search);
        if (search.has("new")) return;

        // If the user already has passkeys stored, redirect to login
        const previousAuthenticators = await authenticatorStorage.getAll();
        if (previousAuthenticators.length > 0) {
            throw redirect({
                to: "/login",
                replace: true,
            });
        }
    },
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
    const { pairingInfo } = usePendingPairingInfo();
    const hasPendingPairing = Boolean(pairingInfo?.id);
    const [disabled, setDisabled] = useState(false);
    const { register, error, isRegisterInProgress, isSuccess } = useRegister(
        {}
    );

    /**
     * Boolean used to know if the error is about a previously used authenticator
     */
    const isPreviouslyUsedAuthenticatorError = useMemo(
        () => !!error && isAuthenticatorAlreadyRegistered(error),
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

    // Redirect after successful registration: pending deep link > pairing > wallet
    useEffect(() => {
        if (isSuccess) {
            if (consumePendingDeepLink(navigate)) return;
            navigate({
                to: hasPendingPairing ? "/pairing" : "/wallet",
                replace: true,
            });
        }
    }, [isSuccess, navigate, hasPendingPairing]);

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
            <DemoTapZone navigate={navigate} />
            <PairingInProgress />
            <ButtonAuth
                onClick={() => register()}
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
