import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import {
    authenticationStore,
    isWebAuthNSupported,
    useLogin,
} from "@frak-labs/wallet-shared";
import { Trans, useTranslation } from "react-i18next";
import { SsoLoginComponent } from "./Sso/SsoLogin";
import { SsoRegisterComponent } from "./Sso/SsoRegister";

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
            <Text as="p" className={className}>
                {t("wallet.openLogin.webauthnNotSupported")}
            </Text>
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
        <>
            <Box>
                <Button
                    loading={loading}
                    onClick={() => {
                        onError(null);
                        login({});
                    }}
                    icon={<FaceIdIcon width={24} height={24} />}
                    className={className}
                >
                    <Trans
                        i18nKey={loginButtonText ?? "wallet.openLogin.login"}
                    />
                </Button>
            </Box>
            <SsoRegisterComponent
                isPrimary={false}
                onSuccess={onSuccess}
                onError={onError}
            />
        </>
    );
}
