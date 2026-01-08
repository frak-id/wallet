import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import {
    authenticationStore,
    HandleErrors,
    isWebAuthNSupported,
    sessionStore,
    useLogin,
} from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import { Grid } from "@/module/common/component/Grid";
import { useMobileLoginRedirect } from "../hook/useMobileLoginRedirect";
import styles from "./OpenLoginFlow.module.css";

type OpenLoginFlowProps = {
    returnUrl: string;
    productId: Hex;
    state?: string;
    productName?: string;
};

export function OpenLoginFlow({
    returnUrl,
    productId,
    state,
    productName,
}: OpenLoginFlowProps) {
    const { t } = useTranslation();
    const {
        executeRedirect,
        isRedirecting,
        error: redirectError,
    } = useMobileLoginRedirect();

    const [error, setError] = useState<Error | null>(null);
    const [isRedirectingState, setIsRedirectingState] = useState(false);

    const lastAuthenticator = authenticationStore(
        (state) => state.lastAuthenticator
    );
    const session = sessionStore((state) => state.session);

    const handleLoginSuccess = useCallback(async () => {
        setIsRedirectingState(true);
        try {
            await executeRedirect({ returnUrl, productId, state });
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setIsRedirectingState(false);
        }
    }, [executeRedirect, returnUrl, productId, state]);

    useEffect(() => {
        if (session && !isRedirectingState) {
            handleLoginSuccess();
        }
    }, [session, isRedirectingState, handleLoginSuccess]);

    if (isRedirectingState || isRedirecting) {
        return (
            <Grid className={styles.openLogin__grid}>
                <Spinner />
                <p className={styles.openLogin__redirecting}>
                    <Trans
                        i18nKey="wallet.openLogin.redirecting"
                        values={{ productName: productName ?? "the app" }}
                    />
                    <span className="dotsLoading">...</span>
                </p>
            </Grid>
        );
    }

    const displayError = error ?? redirectError;

    return (
        <Grid className={styles.openLogin__grid}>
            <h2 className={styles.openLogin__title}>
                {t("wallet.openLogin.title")}
            </h2>
            {productName && (
                <p className={styles.openLogin__subtitle}>
                    <Trans
                        i18nKey="wallet.openLogin.subtitle"
                        values={{ productName }}
                    />
                </p>
            )}

            <AuthActions
                onSuccess={handleLoginSuccess}
                onError={setError}
                lastAuthenticator={lastAuthenticator}
            />

            {displayError && <HandleErrors error={displayError} />}
        </Grid>
    );
}

type LastAuthenticatorType = ReturnType<
    typeof authenticationStore.getState
>["lastAuthenticator"];

function AuthActions({
    onSuccess,
    onError,
    lastAuthenticator,
}: {
    onSuccess: () => void;
    onError: (error: Error | null) => void;
    lastAuthenticator: LastAuthenticatorType;
}) {
    const { t } = useTranslation();
    const { login, isLoading } = useLogin({
        onSuccess: () => onSuccess(),
        onError: (error: Error) => onError(error),
    });

    if (!isWebAuthNSupported) {
        return (
            <p className={styles.openLogin__error}>
                {t("wallet.openLogin.webauthnNotSupported")}
            </p>
        );
    }

    if (lastAuthenticator) {
        return (
            <>
                <SsoLoginComponent
                    onSuccess={onSuccess}
                    onError={onError}
                    isPrimary={true}
                    lastAuthentication={{
                        wallet: lastAuthenticator.address,
                        authenticatorId: lastAuthenticator.authenticatorId,
                        transports: lastAuthenticator.transports,
                    }}
                />
                <SsoRegisterComponent
                    onSuccess={onSuccess}
                    onError={onError}
                    isPrimary={false}
                />
            </>
        );
    }

    return (
        <>
            <ButtonAuth
                disabled={isLoading}
                isLoading={isLoading}
                onClick={() => {
                    onError(null);
                    login({});
                }}
            >
                {t("wallet.openLogin.login")}
            </ButtonAuth>
            <SsoRegisterComponent
                onSuccess={onSuccess}
                onError={onError}
                isPrimary={false}
            />
        </>
    );
}
