import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { WalletIcon } from "@frak-labs/design-system/icons";
import { authenticationStore, sessionStore } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { SsoLoginComponent } from "@/module/authentication/component/Sso/SsoLogin";
import { SsoRegisterComponent } from "@/module/authentication/component/Sso/SsoRegister";
import { useLoginDemo } from "@/module/authentication/hook/useLoginDemo";

export function SsoActions({
    onSuccess,
    onError,
}: {
    onSuccess: () => void;
    onError: (error: Error | null) => void;
}) {
    const lastAuthenticator = useStore(
        authenticationStore,
        (state) => state.lastAuthenticator
    );
    const privateKey = useStore(sessionStore, (state) => state.demoPrivateKey);
    const { login, isLoginInProgress } = useLoginDemo({
        onSuccess: () => onSuccess(),
        onError: (error: Error | null) => onError(error),
    });
    const { t } = useTranslation();

    if (privateKey) {
        return (
            <Box>
                <Button
                    variant="primary"
                    icon={<WalletIcon width={24} height={24} />}
                    onClick={() => login()}
                    loading={isLoginInProgress}
                >
                    {t("authent.sso.btn.existing.login")}
                </Button>
            </Box>
        );
    }

    // Note: the "existing session" smooth path is handled at the parent
    // level (`Sso` component) via the `ContinueAsSession` component.

    // If previous wallet known
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

    // If no previous wallet
    return (
        <>
            <SsoRegisterComponent
                onSuccess={onSuccess}
                onError={onError}
                isPrimary={true}
            />
            <SsoLoginComponent
                onSuccess={onSuccess}
                onError={onError}
                isPrimary={false}
            />
        </>
    );
}
