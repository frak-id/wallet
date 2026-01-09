import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import {
    authenticationStore,
    isWebAuthNSupported,
    useLogin,
} from "@frak-labs/wallet-shared";
import { Trans, useTranslation } from "react-i18next";
import { SsoLoginComponent } from "./Sso/SsoLogin";

type AuthActionsProps = {
    onSuccess: () => void;
    onError: (error: Error | null) => void;
    isLoading?: boolean;
    loginButtonText?: string;
    className?: string;
};

export function AuthActions({
    onSuccess,
    onError,
    isLoading,
    loginButtonText,
    className,
}: AuthActionsProps) {
    const { t } = useTranslation();
    const { login, isLoading: isLoginLoading } = useLogin({
        onSuccess: () => onSuccess(),
        onError: (error: Error) => onError(error),
    });

    const lastAuthenticator = authenticationStore(
        (state) => state.lastAuthenticator
    );
    const loading = isLoading || isLoginLoading;

    if (!isWebAuthNSupported) {
        return (
            <p className={className}>
                {t("wallet.openLogin.webauthnNotSupported")}
            </p>
        );
    }

    if (lastAuthenticator) {
        return (
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
        );
    }

    return (
        <ButtonAuth
            disabled={loading}
            isLoading={loading}
            onClick={() => {
                onError(null);
                login({});
            }}
            className={className}
        >
            <Trans i18nKey={loginButtonText ?? t("wallet.openLogin.login")} />
        </ButtonAuth>
    );
}
